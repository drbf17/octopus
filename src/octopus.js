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

    // Mostrar lista de repos disponíveis
    console.log(chalk.cyan('📋 Repositórios disponíveis:\n'));
    
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
      repositories: selectedRepoObjects.map(repo => ({...repo, active: true})),
      settings: {...this.defaultRepos.settings},
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    };

    // Salvar configuração
    this.saveConfig(config);
    this.config = config;

    console.log(chalk.green(`\n✅ Configuração criada com ${selectedRepos.length} repositório(s)!`));

    // Perguntar se deve instalar dependências
    const { shouldInstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldInstall',
        message: 'Executar npm install nos repositórios existentes?',
        default: true
      }
    ]);

    if (shouldInstall) {
      await this.install();
    }

    // Criar tasks do VS Code
    await this.createVSCodeTasks();

    console.log(chalk.blue('\n🎉 Octopus configurado com sucesso!'));
    console.log(chalk.gray('Use "oct --help" para ver todos os comandos disponíveis.'));
  }

  async clone() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    console.log(chalk.blue('🐙 Clonando repositórios...\n'));

    const parentDir = path.resolve(process.cwd(), '..');
    
    for (const repo of this.config.repositories) {
      if (!repo.active) continue;

      const repoPath = path.resolve(parentDir, path.basename(repo.localPath));
      
      if (fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} já existe em ${repoPath}`));
        continue;
      }

      const spinner = ora(`Clonando ${repo.name}...`).start();

      try {
        const git = simpleGit(parentDir);
        await git.clone(repo.url, path.basename(repo.localPath));
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

      const repoPath = path.resolve(__dirname, '..', repo.localPath);
      
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

      const repoPath = path.resolve(__dirname, '..', repo.localPath);
      
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

      const repoPath = path.resolve(__dirname, '..', repo.localPath);
      
      if (!fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} não encontrado em ${repoPath}`));
        continue;
      }

      const spinner = ora(`Instalando ${repo.name}...`).start();

      try {
        await this.runCommand('npm', ['install'], repoPath);
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

      const repoPath = path.resolve(__dirname, '..', repo.localPath);
      
      if (!fs.existsSync(repoPath)) {
        console.log(chalk.yellow(`⚠️  ${repo.name} não encontrado em ${repoPath}`));
        continue;
      }

      console.log(chalk.cyan(`🚀 Iniciando ${repo.name} na porta ${repo.port}`));

      try {
        // Abrir terminal separado para cada repo
        await this.openTerminal(repo.name, repoPath, 'npm start');
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
      const repoPath = path.resolve(__dirname, '..', repo.localPath);
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

      const repoPath = path.resolve(__dirname, '..', repo.localPath);
      
      const task = {
        label: `${repo.name} - start`,
        type: "shell",
        command: "npm run start",
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
        // Usar AppleScript para abrir novo terminal
        const appleScript = `
          tell application "Terminal"
            activate
            do script "cd '${cwd}' && echo '🐙 ${name} - Iniciando...' && ${command}"
          end tell
        `;

        const process = spawn('osascript', ['-e', appleScript], {
          stdio: 'pipe'
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Terminal script failed with code ${code}`));
          }
        });

        process.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = Octopus;