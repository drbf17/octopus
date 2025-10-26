const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { execa } = require('execa');
const chalk = require('chalk');
const ora = require('ora');
const { Listr } = require('listr2');
const pLimit = require('p-limit');
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

    const parentDir = process.cwd();
    const reposToClone = [];

    // Filtrar repos que precisam ser clonados
    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(parentDir, repo.localPath);
      
      if (fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} já existe em ${repoPath}`));
        continue;
      }

      reposToClone.push(repo);
    }

    if (reposToClone.length === 0) {
      console.log(chalk.blue('🎉 Todos os repositórios já estão clonados!'));
      return;
    }

    // Limitar concorrência para clones (Git pode ser pesado)
    const limit = pLimit(2); // Max 2 clones simultâneos

    const tasks = reposToClone.map(repo => ({
      title: `Clonando: ${repo.name}`,
      task: async (ctx, task) => {
        return limit(async () => {
          try {
            task.output = `Clonando de ${repo.url}...`;
            
            const git = simpleGit(parentDir);
            await git.clone(repo.url, repo.localPath);
            
            task.title = `✅ ${repo.name}: Clonado com sucesso`;
          } catch (error) {
            task.title = `❌ ${repo.name}: Falha no clone`;
            throw new Error(`${repo.name}: ${error.message.split('\n')[0]}`);
          }
        });
      }
    }));

    const listr = new Listr(tasks, {
      concurrent: true,
      exitOnError: false,
      rendererOptions: {
        showSubtasks: false,
        showErrorMessage: true
      }
    });

    try {
      console.log(chalk.blue('🐙 Clonando repositórios...\n'));
      await listr.run();
      console.log(chalk.green('\n🎉 Clonagem concluída!'));
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Alguns repositórios falharam no clone. Verifique os logs acima.'));
    }
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

    // Preparar lista de repositórios válidos
    const validRepos = [];
    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(process.cwd(), repo.localPath);
      
      if (!fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} não encontrado em ${repoPath}`));
        continue;
      }

      // Detectar package manager automaticamente
      const hasYarnLock = fs.existsSync(path.join(repoPath, 'yarn.lock'));
      const hasPackageLock = fs.existsSync(path.join(repoPath, 'package-lock.json'));
      const packageManager = hasYarnLock ? 'yarn' : hasPackageLock ? 'npm' : 'yarn';

      validRepos.push({ ...repo, repoPath, packageManager });
    }

    if (validRepos.length === 0) {
      console.log(chalk.yellow('⚠️  Nenhum repositório válido encontrado!'));
      return;
    }

    // Limitar concorrência para evitar sobrecarregar o sistema
    const limit = pLimit(3); // Max 3 instalações simultâneas

    // Criar tasks do Listr2 para melhor UX
    const tasks = validRepos.map(repo => ({
      title: `Instalando dependências: ${repo.name}`,
      task: async (ctx, task) => {
        return limit(async () => {
          try {
            task.output = `Usando ${repo.packageManager}...`;
            
            const installCommand = repo.packageManager === 'yarn' ? 'yarn' : 'npm';
            const installArgs = repo.packageManager === 'yarn' ? ['install'] : ['install', '--silent'];
            
            await this.runCommand(installCommand, installArgs, repo.repoPath, {
              timeout: 180000 // 3 minutos por repo
            });
            
            task.title = `✅ ${repo.name}: Dependências instaladas`;
            return { name: repo.name, success: true };
          } catch (error) {
            task.title = `❌ ${repo.name}: Falha na instalação`;
            throw new Error(`${repo.name}: ${error.message.split('\n')[0]}`); // Primeira linha do erro
          }
        });
      }
    }));

    const listr = new Listr(tasks, {
      concurrent: true,
      exitOnError: false,
      rendererOptions: {
        showSubtasks: false,
        collapse: false,
        showErrorMessage: true
      }
    });

    try {
      console.log(chalk.blue('🐙 Instalando dependências...\n'));
      await listr.run();
      console.log(chalk.green('\n🎉 Instalação concluída!'));
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Algumas instalações falharam. Verifique os logs acima.'));
    }
  }

  async start() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    console.log(chalk.blue('🐙 Iniciando servidores de desenvolvimento...\n'));

    const validRepos = [];
    
    // Validar repos primeiro
    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(process.cwd(), repo.localPath);
      
      if (!fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} não encontrado em ${repoPath}`));
        continue;
      }

      validRepos.push({ ...repo, repoPath });
    }

    if (validRepos.length === 0) {
      console.log(chalk.yellow('⚠️  Nenhum repositório válido encontrado!'));
      return;
    }

    // Iniciar cada repositório
    for (const repo of validRepos) {
      console.log(chalk.cyan(`🚀 Iniciando ${repo.name} na porta ${repo.port}`));

      try {
        await this.openTerminalImproved(repo.name, repo.repoPath, 'yarn start');
      } catch (error) {
        console.error(chalk.red(`⚠️  Erro ao abrir terminal para ${repo.name}: ${error.message}`));
      }
    }

    console.log(chalk.green('\n🎉 Todos os servidores foram iniciados!'));
    console.log(chalk.blue('💡 Cada repositório está rodando em seu próprio terminal.'));
  }

  async startWithConcurrently() {
    console.log(chalk.blue('🐙 Iniciando com Concurrently (modo paralelo)...\n'));
    
    const validRepos = this.getValidRepos();
    if (validRepos.length === 0) return;

    const commands = validRepos.map(repo => ({
      command: 'yarn start',
      name: repo.name,
      cwd: repo.repoPath,
      prefixColor: this.getColorForRepo(repo.name)
    }));

    try {
      const concurrently = require('concurrently');
      const { result } = concurrently(
        commands.map(cmd => ({
          command: cmd.command,
          name: cmd.name,
          cwd: cmd.cwd,
          prefixColor: cmd.prefixColor
        })),
        {
          prefix: 'name',
          killOthers: ['failure', 'success'],
          restartTries: 3,
          restartDelay: 1000
        }
      );

      await result;
    } catch (error) {
      console.error(chalk.red('❌ Erro no modo concurrently:'), error.message);
    }
  }

  async startWithPM2() {
    console.log(chalk.blue('🐙 Iniciando com PM2 (modo daemon)...\n'));
    
    const validRepos = this.getValidRepos();
    if (validRepos.length === 0) return;

    // Criar ecosystem.config.js para PM2
    const pm2Config = {
      apps: validRepos.map(repo => ({
        name: repo.name,
        cwd: repo.repoPath,
        script: 'yarn',
        args: 'start',
        env: {
          PORT: repo.port,
          NODE_ENV: 'development'
        },
        watch: false,
        ignore_watch: ['node_modules', 'dist', 'build'],
        restart_delay: 1000,
        max_restarts: 10
      }))
    };

    const ecosystemFile = path.join(process.cwd(), 'ecosystem.config.js');
    fs.writeFileSync(ecosystemFile, `module.exports = ${JSON.stringify(pm2Config, null, 2)};`);

    try {
      await this.runCommand('npx', ['pm2', 'start', 'ecosystem.config.js'], process.cwd());
      console.log(chalk.green('✅ PM2 ecosystem iniciado!'));
      console.log(chalk.blue('💡 Use "npx pm2 list" para ver status'));
      console.log(chalk.blue('💡 Use "npx pm2 stop all" para parar todos'));
      console.log(chalk.blue('💡 Use "npx pm2 logs" para ver logs'));
    } catch (error) {
      console.error(chalk.red('❌ Erro ao iniciar PM2:'), error.message);
    }
  }

  async startWithTmux() {
    console.log(chalk.blue('🐙 Iniciando com Tmux (sessões organizadas)...\n'));
    
    const validRepos = this.getValidRepos();
    if (validRepos.length === 0) return;

    const sessionName = `octopus-${this.config.projectName || 'dev'}`;

    try {
      // Criar nova sessão tmux
      await this.runCommand('tmux', ['new-session', '-d', '-s', sessionName], process.cwd());
      
      for (let i = 0; i < validRepos.length; i++) {
        const repo = validRepos[i];
        
        if (i > 0) {
          // Criar nova janela para repos adicionais
          await this.runCommand('tmux', ['new-window', '-t', sessionName, '-n', repo.name], process.cwd());
        } else {
          // Renomear primeira janela
          await this.runCommand('tmux', ['rename-window', '-t', sessionName, repo.name], process.cwd());
        }
        
        // Navegar para diretório e iniciar comando
        await this.runCommand('tmux', ['send-keys', '-t', `${sessionName}:${repo.name}`, `cd ${repo.repoPath}`, 'Enter'], process.cwd());
        await this.runCommand('tmux', ['send-keys', '-t', `${sessionName}:${repo.name}`, 'yarn start', 'Enter'], process.cwd());
      }

      console.log(chalk.green(`✅ Sessão Tmux "${sessionName}" criada!`));
      console.log(chalk.blue(`💡 Use "tmux attach -t ${sessionName}" para acessar`));
      console.log(chalk.blue('💡 Use Ctrl+B, D para desanexar'));
      console.log(chalk.blue('💡 Use Ctrl+B, W para navegar entre janelas'));
    } catch (error) {
      console.error(chalk.red('❌ Erro ao usar Tmux:'), error.message);
      console.log(chalk.yellow('💡 Instale tmux: brew install tmux (macOS) ou apt install tmux (Linux)'));
    }
  }

  async startWithTerminal() {
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
        console.error(chalk.red(`⚠️  Erro ao abrir terminal para ${repo.name}: ${error.message}`));
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

    const startTaskLabels = [];
    const lintTaskLabels = [];
    const testTaskLabels = [];

    // Criar task individual para cada repo
    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(process.cwd(), repo.localPath);
      
      // Task de start
      const startTask = {
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

      tasksConfig.tasks.push(startTask);
      startTaskLabels.push(startTask.label);

      // Task de lint
      const lintTask = {
        label: `${repo.name} - lint`,
        type: "shell",
        command: "yarn lint",
        options: {
          cwd: repoPath
        },
        group: "test",
        presentation: {
          echo: true,
          reveal: "always",
          focus: false,
          panel: "new",
          showReuseMessage: true,
          clear: false
        },
        problemMatcher: ["$eslint-stylish"]
      };

      tasksConfig.tasks.push(lintTask);
      lintTaskLabels.push(lintTask.label);

      // Task de test
      const testTask = {
        label: `${repo.name} - test`,
        type: "shell",
        command: "yarn test --coverage",
        options: {
          cwd: repoPath
        },
        group: "test",
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

      tasksConfig.tasks.push(testTask);
      testTaskLabels.push(testTask.label);

      // Tasks específicas do Host (Android e iOS)
      if (repo.isHost) {
        // Task Android
        const androidTask = {
          label: `${repo.name} - Android`,
          type: "shell",
          command: "yarn android",
          options: {
            cwd: repoPath
          },
          group: "build",
          presentation: {
            echo: true,
            reveal: "always",
            focus: true,
            panel: "new",
            showReuseMessage: true,
            clear: false
          },
          problemMatcher: []
        };

        tasksConfig.tasks.push(androidTask);

        // Task iOS (com pod install)
        const iosTask = {
          label: `${repo.name} - iOS`,
          type: "shell",
          command: "cd ios && pod install && cd .. && yarn ios",
          options: {
            cwd: repoPath
          },
          group: "build",
          presentation: {
            echo: true,
            reveal: "always",
            focus: true,
            panel: "new",
            showReuseMessage: true,
            clear: false
          },
          problemMatcher: []
        };

        tasksConfig.tasks.push(iosTask);
      }
    }

    // Tasks compostas
    const compoundTasks = [
      {
        label: "Octopus - Start All",
        dependsOrder: "parallel",
        dependsOn: startTaskLabels
      },
      {
        label: "Octopus - Lint All",
        dependsOrder: "parallel", 
        dependsOn: lintTaskLabels
      },
      {
        label: "Octopus - Test All",
        dependsOrder: "parallel",
        dependsOn: testTaskLabels
      }
    ];

    tasksConfig.tasks.push(...compoundTasks);

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

  async runCommand(command, args, cwd, options = {}) {
    try {
      const result = await execa(command, args, {
        cwd,
        shell: true,
        timeout: options.timeout || 300000, // 5 minutos default
        ...options
      });
      return result;
    } catch (error) {
      // Melhor tratamento de erro com informações detalhadas
      const errorInfo = {
        command: `${command} ${args.join(' ')}`,
        cwd,
        exitCode: error.exitCode,
        stderr: error.stderr,
        stdout: error.stdout
      };
      
      throw new Error(`Command failed: ${errorInfo.command}\nExit code: ${errorInfo.exitCode}\nError: ${errorInfo.stderr || error.message}`);
    }
  }

  async openTerminalImproved(name, cwd, command) {
    return new Promise((resolve) => {
      try {
        const platform = process.platform;
        let terminalCommand;
        let args;

        if (platform === 'darwin') {
          // macOS - AppleScript melhorado com tratamento de erro
          const appleScript = `
            tell application "Terminal"
              activate
              set newTab to do script "cd '${cwd.replace(/'/g, "'\\''")}'"
              delay 0.5
              do script "echo '🐙 ${name} - Iniciando...' && ${command}" in newTab
            end tell
          `;
          terminalCommand = 'osascript';
          args = ['-e', appleScript];
        } else if (platform === 'win32') {
          // Windows - melhorado
          terminalCommand = 'cmd';
          args = ['/c', 'start', 'cmd', '/k', `cd /d "${cwd}" && echo 🐙 ${name} - Iniciando... && ${command}`];
        } else {
          // Linux - tentar múltiplos terminais
          const terminals = [
            ['gnome-terminal', ['--working-directory', cwd, '--', 'bash', '-c', `echo '🐙 ${name} - Iniciando...' && ${command}; exec bash`]],
            ['xterm', ['-e', `bash -c "cd '${cwd}' && echo '🐙 ${name} - Iniciando...' && ${command}; exec bash"`]],
            ['konsole', ['--workdir', cwd, '-e', `bash -c "echo '🐙 ${name} - Iniciando...' && ${command}; exec bash"`]]
          ];
          
          let terminalFound = false;
          for (const [terminal, termArgs] of terminals) {
            try {
              terminalCommand = terminal;
              args = termArgs;
              terminalFound = true;
              break;
            } catch (e) {
              continue;
            }
          }
          
          if (!terminalFound) {
            console.warn(chalk.yellow(`⚠️  Nenhum terminal compatível encontrado para ${name}`));
            resolve();
            return;
          }
        }

        // Executar comando com timeout
        const childProcess = spawn(terminalCommand, args, {
          stdio: 'ignore', // Ignorar output para evitar problemas
          detached: true,  // Processo independente
          shell: platform === 'win32'
        });

        // Timeout para não travar
        const timeout = setTimeout(() => {
          resolve();
        }, 3000);

        childProcess.on('spawn', () => {
          clearTimeout(timeout);
          resolve();
        });

        childProcess.on('error', (error) => {
          clearTimeout(timeout);
          console.warn(chalk.yellow(`⚠️  Erro ao abrir terminal para ${name}: ${error.message}`));
          resolve();
        });

        // Desanexar processo para não afetar o octopus
        if (childProcess.pid) {
          childProcess.unref();
        }

      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Erro ao abrir terminal para ${name}: ${error.message}`));
        resolve();
      }
    });
  }


}

module.exports = Octopus;