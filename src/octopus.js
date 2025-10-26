const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const simpleGit = require('simple-git');

class Octopus {
  constructor() {
    this.configPath = path.join(__dirname, '../config/octopus-config.json');
    this.defaultReposPath = path.join(__dirname, '../config/default-repos.json');
    this.vscodeDir = path.join(process.cwd(), '.vscode');
    this.tasksFile = path.join(this.vscodeDir, 'tasks.json');
    
    this.config = this.loadConfig();
    this.defaultRepos = this.loadDefaultRepos();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configData);
      }
      return null;
    } catch (error) {
      console.error(chalk.red('❌ Erro ao carregar configuração:'), error.message);
      return null;
    }
  }

  loadDefaultRepos() {
    try {
      const reposData = fs.readFileSync(this.defaultReposPath, 'utf8');
      return JSON.parse(reposData);
    } catch (error) {
      console.error(chalk.red('❌ Erro ao carregar repositórios padrão:'), error.message);
      process.exit(1);
    }
  }

  saveConfig(config) {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(chalk.red('❌ Erro ao salvar configuração:'), error.message);
    }
  }

  async init() {
    console.log(chalk.blue('🐙 Iniciando Octopus...\n'));

    if (this.config) {
      console.log(chalk.yellow('⚠️  Configuração já existe!'));
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Deseja reconfigurar?',
          default: false
        }
      ]);

      if (!overwrite) {
        console.log(chalk.gray('Configuração mantida.'));
        return;
      }
    }

    // Perguntar nome do projeto
    const { projectName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Nome do projeto (para workspace VS Code):',
        default: path.basename(process.cwd()),
        validate: (input) => input.trim().length > 0 || 'Nome do projeto é obrigatório'
      }
    ]);

    // Mostrar lista de repos disponíveis
    console.log(chalk.cyan('\n📋 Repositórios disponíveis:\n'));
    
    const choices = this.defaultRepos.repositories.map(repo => ({
      name: `${repo.name} - ${repo.description} (porta: ${repo.port})`,
      value: repo.name,
      checked: repo.active
    }));

    const { selectedRepos } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedRepos',
        message: 'Selecione os repositórios que deseja usar:',
        choices: choices,
        validate: (input) => {
          if (input.length === 0) {
            return 'Selecione pelo menos um repositório!';
          }
          return true;
        }
      }
    ]);

    // Filtrar repos selecionados
    const selectedRepoObjects = this.defaultRepos.repositories.filter(repo => 
      selectedRepos.includes(repo.name)
    );

    // Criar configuração
    const config = {
      projectName: projectName.trim(),
      repositories: selectedRepoObjects.map(repo => ({...repo, active: true})),
      settings: {...this.defaultRepos.settings},
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    };

    // Salvar configuração
    this.saveConfig(config);
    this.config = config;

    console.log(chalk.green(`\n✅ Configuração criada com ${selectedRepos.length} repositório(s)!`));

    // Perguntar se deve clonar repositórios
    const { shouldClone } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldClone',
        message: 'Clonar repositórios que ainda não existem?',
        default: true
      }
    ]);

    if (shouldClone) {
      await this.clone();
    }

    // Perguntar se deve instalar dependências
    const { shouldInstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldInstall',
        message: 'Executar yarn install nos repositórios existentes?',
        default: true
      }
    ]);

    if (shouldInstall) {
      await this.install();
    }

    // Criar tasks do VS Code
    await this.createVSCodeTasks();

    // Criar workspace VS Code
    await this.createVSCodeWorkspace();

    console.log(chalk.blue('\n🎉 Octopus configurado com sucesso!'));
    console.log(chalk.gray('Use "oct --help" para ver todos os comandos disponíveis.'));
  }

  async clone() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    console.log(chalk.blue('🐙 Clonando repositórios...\n'));

    // Usar diretório atual como base, não o diretório do octopus
    const parentDir = process.cwd();

    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(parentDir, repo.localPath);
      
      if (fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} já existe em ${repoPath}`));
        continue;
      }      const spinner = ora(`Clonando ${repo.name}...`).start();

      try {
        const git = simpleGit(parentDir);
        await git.clone(repo.url, repo.localPath);
        spinner.succeed(chalk.green(`✅ ${repo.name} clonado com sucesso`));
      } catch (error) {
        spinner.fail(chalk.red(`❌ Erro ao clonar ${repo.name}: ${error.message}`));
      }
    }

    console.log(chalk.green('\n🎉 Clonagem concluída!'));
  }

  async checkout(branch) {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    console.log(chalk.blue(`🐙 Fazendo checkout para branch "${branch}"...\n`));

    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(process.cwd(), repo.localPath);
      
      if (!fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} não encontrado em ${repoPath}`));
        continue;
      }

      const spinner = ora(`${repo.name}: checkout ${branch}`).start();

      try {
        const git = simpleGit(repoPath);
        await git.checkout(branch);
        await git.pull();
        spinner.succeed(chalk.green(`✅ ${repo.name}: checkout e pull concluídos`));
      } catch (error) {
        spinner.fail(chalk.red(`❌ ${repo.name}: ${error.message}`));
      }
    }

    console.log(chalk.green('\n🎉 Checkout concluído em todos os repositórios!'));
  }

  async newBranch(name, base) {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    const baseBranch = base || this.config.settings.defaultBranch || 'main';
    console.log(chalk.blue(`🐙 Criando branch "${name}" baseada em "${baseBranch}"...\n`));

    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(process.cwd(), repo.localPath);
      
      if (!fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} não encontrado em ${repoPath}`));
        continue;
      }

      const spinner = ora(`${repo.name}: criando branch ${name}`).start();

      try {
        const git = simpleGit(repoPath);
        await git.checkout(baseBranch);
        await git.pull();
        await git.checkoutLocalBranch(name);
        spinner.succeed(chalk.green(`✅ ${repo.name}: branch "${name}" criada`));
      } catch (error) {
        spinner.fail(chalk.red(`❌ ${repo.name}: ${error.message}`));
      }
    }

    console.log(chalk.green(`\n🎉 Branch "${name}" criada em todos os repositórios!`));
  }

  async install() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    console.log(chalk.blue('🐙 Instalando dependências...\n'));

    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(process.cwd(), repo.localPath);
      
      if (!fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} não encontrado em ${repoPath}`));
        continue;
      }

      const spinner = ora(`Instalando ${repo.name}...`).start();

      try {
        await this.runCommand('yarn', ['install'], repoPath);
        spinner.succeed(chalk.green(`✅ ${repo.name}: dependências instaladas`));
      } catch (error) {
        spinner.fail(chalk.red(`❌ ${repo.name}: ${error.message}`));
      }
    }

    console.log(chalk.green('\n🎉 Instalação concluída em todos os repositórios!'));
  }

  async start() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    console.log(chalk.blue('🐙 Iniciando servidores de desenvolvimento...\n'));

    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(process.cwd(), repo.localPath);
      
      if (!fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} não encontrado em ${repoPath}`));
        continue;
      }

      console.log(chalk.cyan(`🚀 Iniciando ${repo.name} na porta ${repo.port}`));

      try {
        // Abrir terminal separado para cada repo
        await this.openTerminal(repo.name, repoPath, 'yarn start');
      } catch (error) {
        console.error(chalk.red(`❌ Erro ao iniciar ${repo.name}:`), error.message);
      }
    }

    console.log(chalk.green('\n🎉 Todos os servidores foram iniciados!'));
    console.log(chalk.blue('💡 Cada repositório está rodando em seu próprio terminal.'));
  }

  async status() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    console.log(chalk.blue('🐙 Status dos repositós:\n'));

    for (const repo of this.config.repositories) {
      const repoPath = path.resolve(process.cwd(), repo.localPath);
      const exists = fs.existsSync(repoPath);
      const statusIcon = repo.active ? (exists ? '🟢' : '🟡') : '🔴';
      const statusText = repo.active ? (exists ? 'Ativo' : 'Não clonado') : 'Inativo';
      
      console.log(chalk.cyan(`${statusIcon} ${repo.name}`));
      console.log(chalk.gray(`   Status: ${statusText}`));
      console.log(chalk.gray(`   URL: ${repo.url}`));
      console.log(chalk.gray(`   Path: ${repoPath}`));
      console.log(chalk.gray(`   Porta: ${repo.port}`));
      console.log('');
    }
  }

  async list() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    console.log(chalk.blue('🐙 Repositórios configurados:\n'));

    this.config.repositories.forEach(repo => {
      const icon = repo.active ? '✅' : '❌';
      console.log(chalk.cyan(`${icon} ${repo.name}`));
      console.log(chalk.gray(`   ${repo.description}`));
      console.log(chalk.gray(`   Porta: ${repo.port} | Prioridade: ${repo.priority}`));
      console.log('');
    });
  }

  async createVSCodeTasks() {
    if (!this.config.settings.createVSCodeTasks) return;

    console.log(chalk.yellow('🖥️  Criando tasks do VS Code...\n'));

    const tasksConfig = {
      version: "2.0.0",
      tasks: []
    };

    // Criar task individual para cada repo
    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(process.cwd(), repo.localPath);
      
      const task = {
        label: `${repo.name} - start`,
        type: "shell",
        command: "yarn start",
        options: {
          cwd: repoPath
        },
        group: "build",
        presentation: {
          echo: true,
          reveal: "always",
          focus: false,
          panel: "new",
          showReuseMessage: true,
          clear: false
        },
        problemMatcher: []
      };

      tasksConfig.tasks.push(task);
    }

    // Criar task composta
    const compoundTask = {
      label: "Octopus - Start All",
      dependsOrder: "parallel",
      dependsOn: tasksConfig.tasks.map(task => task.label)
    };

    tasksConfig.tasks.push(compoundTask);

    // Salvar tasks.json
    if (!fs.existsSync(this.vscodeDir)) {
      fs.mkdirSync(this.vscodeDir, { recursive: true });
    }

    fs.writeFileSync(this.tasksFile, JSON.stringify(tasksConfig, null, 2));
    console.log(chalk.green('✅ Tasks do VS Code criadas!'));
    console.log(chalk.blue('💡 Use Cmd+Shift+P > "Tasks: Run Task" > "Octopus - Start All"'));
  }

  async createVSCodeWorkspace() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    // Criar estrutura do workspace
    const workspaceConfig = {
      folders: [],
      settings: {
        "typescript.preferences.includePackageJsonAutoImports": "auto",
        "eslint.workingDirectories": [],
        "files.exclude": {
          "**/node_modules": true,
          "**/.*": false
        },
        "search.exclude": {
          "**/node_modules": true,
          "**/yarn.lock": true,
          "**/package-lock.json": true
        },
        "terminal.integrated.cwd": "."
      },
      extensions: {
        recommendations: [
          "ms-vscode.vscode-typescript-next",
          "esbenp.prettier-vscode",
          "ms-vscode.vscode-eslint",
          "bradlc.vscode-tailwindcss",
          "ms-vscode.vscode-json"
        ]
      },
      tasks: {
        version: "2.0.0",
        tasks: []
      }
    };

    // Adicionar pasta raiz do projeto (onde ficam .vscode, workspace, etc)
    workspaceConfig.folders.push({
      name: "📁 Projeto Root",
      path: "."
    });

    // Adicionar pasta do próprio Octopus
    const octopusPath = path.relative(process.cwd(), path.resolve(__dirname, '..'));
    workspaceConfig.folders.push({
      name: "🐙 Octopus (CLI)",
      path: octopusPath
    });

    // Adicionar cada repositório como uma pasta do workspace
    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(process.cwd(), repo.localPath);
      const relativePath = path.relative(process.cwd(), repoPath);
      
      workspaceConfig.folders.push({
        name: `${repo.name} (${repo.port})`,
        path: relativePath
      });

      // Adicionar ao working directories do ESLint se o diretório existir
      if (fs.existsSync(repoPath)) {
        workspaceConfig.settings["eslint.workingDirectories"].push(relativePath);
      }
    }

    // Adicionar Octopus ao working directories do ESLint
    workspaceConfig.settings["eslint.workingDirectories"].push(octopusPath);

    // Salvar arquivo de workspace
    const workspaceFile = path.join(process.cwd(), `${this.config.projectName || 'octopus'}-workspace.code-workspace`);
    fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig, null, 2));

    console.log(chalk.green(`✅ Workspace VS Code criado: ${path.basename(workspaceFile)}`));
    console.log(chalk.blue('💡 Abra o workspace: File > Open Workspace from File'));
  }

  async runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd: cwd,
        stdio: 'pipe',
        shell: true
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  async openTerminal(name, cwd, command) {
    return new Promise((resolve, reject) => {
      try {
        const platform = process.platform;
        let terminalCommand;
        let args;

        if (platform === 'darwin') {
          // macOS - usar AppleScript
          const appleScript = `
            tell application "Terminal"
              activate
              do script "cd '${cwd}' && echo '🐙 ${name} - Iniciando...' && ${command}"
            end tell
          `;
          terminalCommand = 'osascript';
          args = ['-e', appleScript];
        } else if (platform === 'win32') {
          // Windows - usar cmd
          terminalCommand = 'cmd';
          args = ['/c', 'start', 'cmd', '/k', `cd /d "${cwd}" && echo 🐙 ${name} - Iniciando... && ${command}`];
        } else {
          // Linux/outros - usar gnome-terminal ou xterm como fallback
          terminalCommand = 'gnome-terminal';
          args = ['--working-directory', cwd, '--', 'bash', '-c', `echo '🐙 ${name} - Iniciando...' && ${command}; exec bash`];
        }

        const process = spawn(terminalCommand, args, {
          stdio: 'pipe',
          shell: platform === 'win32' // Shell apenas no Windows
        });

        process.on('close', (code) => {
          resolve(); // Sempre resolve, pois falhas de terminal não devem parar o processo
        });

        process.on('error', (error) => {
          console.warn(chalk.yellow(`⚠️  Não foi possível abrir terminal para ${name}: ${error.message}`));
          resolve(); // Resolve mesmo com erro para não interromper outros repositórios
        });
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Erro ao abrir terminal para ${name}: ${error.message}`));
        resolve();
      }
    });
  }

  async android() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    // Encontrar o repositório Host
    const hostRepo = this.config.repositories.find(repo => repo.isHost && repo.active);
    
    if (!hostRepo) {
      console.log(chalk.red('❌ Repositório Host não encontrado ou não ativo!'));
      console.log(chalk.yellow('💡 Verifique se existe um repositório com "isHost": true na configuração.'));
      return;
    }

    const repoPath = path.resolve(process.cwd(), hostRepo.localPath);
    
    if (!fs.existsSync(repoPath)) {
      console.log(chalk.red(`❌ Repositório ${hostRepo.name} não encontrado em ${repoPath}`));
      console.log(chalk.blue('💡 Execute "oct clone" primeiro.'));
      return;
    }

    console.log(chalk.cyan(`🤖 Executando Android no ${hostRepo.name}...`));

    try {
      await this.openTerminal(`${hostRepo.name} - Android`, repoPath, 'yarn android');
      console.log(chalk.green('✅ Android iniciado com sucesso!'));
    } catch (error) {
      console.error(chalk.red(`❌ Erro ao iniciar Android: ${error.message}`));
    }
  }

  async ios() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    // Encontrar o repositório Host
    const hostRepo = this.config.repositories.find(repo => repo.isHost && repo.active);
    
    if (!hostRepo) {
      console.log(chalk.red('❌ Repositório Host não encontrado ou não ativo!'));
      console.log(chalk.yellow('💡 Verifique se existe um repositório com "isHost": true na configuração.'));
      return;
    }

    const repoPath = path.resolve(process.cwd(), hostRepo.localPath);
    
    if (!fs.existsSync(repoPath)) {
      console.log(chalk.red(`❌ Repositório ${hostRepo.name} não encontrado em ${repoPath}`));
      console.log(chalk.blue('💡 Execute "oct clone" primeiro.'));
      return;
    }

    console.log(chalk.cyan(`🍎 Executando iOS no ${hostRepo.name}...`));
    console.log(chalk.blue('📦 Primeiro executando pod install...'));

    try {
      // Primeiro executar pod install no diretório ios
      const iosPath = path.join(repoPath, 'ios');
      if (fs.existsSync(iosPath)) {
        console.log(chalk.gray('⏳ Instalando pods...'));
        await this.runCommand('pod', ['install'], iosPath);
        console.log(chalk.green('✅ Pod install concluído!'));
      } else {
        console.log(chalk.yellow('⚠️ Pasta ios não encontrada, pulando pod install'));
      }

      // Depois executar yarn ios
      await this.openTerminal(`${hostRepo.name} - iOS`, repoPath, 'yarn ios');
      console.log(chalk.green('✅ iOS iniciado com sucesso!'));
    } catch (error) {
      console.error(chalk.red(`❌ Erro ao iniciar iOS: ${error.message}`));
    }
  }
}

module.exports = Octopus;