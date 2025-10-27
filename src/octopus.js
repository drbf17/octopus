const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { execa } = require('execa');
const chalk = require('chalk');
const ora = require('ora');
const { Listr } = require('listr2');
const inquirer = require('inquirer');
const simpleGit = require('simple-git');

// Implementação simples de limitador de concorrência
function createLimit(concurrency) {
  let running = 0;
  const queue = [];

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          running--;
          if (queue.length > 0 && running < concurrency) {
            const next = queue.shift();
            next();
          }
        }
      };

      if (running < concurrency) {
        execute();
      } else {
        queue.push(execute);
      }
    });
  };
}

class Octopus {
  constructor() {
    this.configPath = path.join(__dirname, '../config/octopus-config.json');
    this.defaultReposPath = path.join(__dirname, '../config/default-repos.json');
    
    this.config = this.loadConfig();
    this.defaultRepos = this.loadDefaultRepos();
  }

  // Helper para verificar se um script existe no package.json
  checkScriptExists(scriptName, repoPath) {
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        console.log(chalk.red(`📄 package.json não encontrado: ${packageJsonPath}`));
        return false;
      }
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const hasScript = !!(packageJson.scripts && packageJson.scripts[scriptName]);
      
      console.log(chalk.blue(`📋 Scripts disponíveis em ${path.basename(repoPath)}:`));
      if (packageJson.scripts) {
        Object.keys(packageJson.scripts).forEach(script => {
          const marker = script === scriptName ? '✅' : '  ';
          console.log(chalk.gray(`   ${marker} ${script}: ${packageJson.scripts[script]}`));
        });
      } else {
        console.log(chalk.gray(`   ❌ Nenhum script encontrado`));
      }
      
      return hasScript;
    } catch (error) {
      console.log(chalk.red(`❌ Erro ao ler package.json: ${error.message}`));
      return false;
    }
  }

  // Helper para construir comandos com prefixo opcional para monorepos
  buildCommand(baseCommand, repo) {
    if (repo.prefix) {
      const commandWithoutYarn = baseCommand.replace('yarn ', '');
      
      // Para monorepos, a estratégia mais comum é: yarn <prefix> <comando>
      // Exemplo: yarn host install
      const finalCommand = `yarn ${repo.prefix} ${commandWithoutYarn}`;
      
      console.log(chalk.blue(`🔄 [${repo.name}] ${baseCommand} → ${finalCommand} (monorepo com prefix)`));
      
      return finalCommand;
    }
    return baseCommand;
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

    // Criar workspace VS Code (sem tasks complexas)
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
    const limit = createLimit(2); // Max 2 clones simultâneos

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

      // Usar yarn conforme política do octopus
      const packageManager = 'yarn';

      validRepos.push({ ...repo, repoPath, packageManager });
    }

    if (validRepos.length === 0) {
      console.log(chalk.yellow('⚠️  Nenhum repositório válido encontrado!'));
      return;
    }

    // Limitar concorrência para evitar sobrecarregar o sistema
    const limit = createLimit(3); // Max 3 instalações simultâneas

    // Criar tasks do Listr2 para melhor UX
    const tasks = validRepos.map(repo => ({
      title: `Instalando dependências: ${repo.name}`,
      task: async (ctx, task) => {
        return limit(async () => {
          try {
            const fullCommand = this.buildCommand('yarn install', repo);
            const commandParts = fullCommand.split(' ');
            const installCommand = commandParts[0]; // sempre 'yarn'
            const installArgs = commandParts.slice(1); // ['install'] ou ['host', 'install']
            
            // Log detalhado para troubleshooting
            console.log(chalk.cyan(`🔍 [${repo.name}] Comando: ${installCommand} ${installArgs.join(' ')}`));
            console.log(chalk.gray(`   Diretório: ${repo.repoPath}`));
            console.log(chalk.gray(`   Prefix: ${repo.prefix || 'nenhum'}`));
            
            task.output = `Executando: ${fullCommand}`;
            
            // Tentar executar com fallback automático para repos com prefix
            if (repo.prefix) {
              await this.runCommandWithFallback(repo, 'install', {
                timeout: 180000 // 3 minutos por repo
              });
            } else {
              await this.runCommand(installCommand, installArgs, repo.repoPath, {
                timeout: 180000 // 3 minutos por repo
              });
            }
            
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

  async start(mode = 'unified') {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    const validRepos = this.getValidRepos();
    if (validRepos.length === 0) return;

    // Por padrão usar terminal unificado com concurrently
    if (mode === 'unified' || mode === 'concurrently') {
      return this.startUnified(validRepos);
    } else if (mode === 'separate') {
      return this.startSeparateTerminals(validRepos);
    }
  }

  async startUnified(validRepos) {
    console.log(chalk.blue('🐙 Iniciando servidores em terminal unificado...\n'));

    // Usar yarn conforme política do octopus
    const commands = validRepos.map(repo => {
      const startCommand = this.buildCommand('yarn start', repo);
      
      return {
        name: `${repo.name}:${repo.port}`,
        command: startCommand,
        cwd: repo.repoPath,
        prefixColor: this.getColorForRepo(repo.name)
      };
    });

    console.log(chalk.cyan('📋 Serviços que serão iniciados:'));
    commands.forEach(cmd => {
      console.log(chalk.gray(`   • ${cmd.name} (${cmd.command})`));
    });
    
    console.log(chalk.blue('\n🚀 Iniciando todos os serviços...\n'));

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
          killOthers: ['failure'],
          restartTries: 3,
          restartDelay: 2000,
          prefixColors: ['cyan', 'magenta', 'green', 'yellow', 'blue', 'red'],
          timestampFormat: 'HH:mm:ss'
        }
      );

      // Mostrar informações úteis
      console.log(chalk.green('✅ Todos os serviços iniciados com sucesso!'));
      console.log(chalk.blue('\n💡 Dicas:'));
      console.log(chalk.gray('   • Use Ctrl+C para parar todos os serviços'));
      console.log(chalk.gray('   • Os logs são coloridos por serviço'));
      console.log(chalk.gray('   • Restart automático em caso de falha'));
      
      await result;
      
    } catch (error) {
      console.error(chalk.red('\n❌ Erro ao iniciar serviços:'), error.message);
      console.log(chalk.yellow('\n💡 Tente usar modo separado: oct start --mode separate'));
    }
  }

  async startSeparateTerminals(validRepos) {
    console.log(chalk.blue('🐙 Iniciando servidores em terminais separados...\n'));

    // Iniciar cada repositório em terminal separado
    for (const repo of validRepos) {
      console.log(chalk.cyan(`🚀 Iniciando ${repo.name} na porta ${repo.port}`));

      try {
        const startCommand = this.buildCommand('yarn start', repo);
        await this.openTerminalImproved(repo.name, repo.repoPath, startCommand);
      } catch (error) {
        console.error(chalk.red(`⚠️  Erro ao abrir terminal para ${repo.name}: ${error.message}`));
      }
    }

    console.log(chalk.green('\n🎉 Todos os servidores foram iniciados!'));
    console.log(chalk.blue('💡 Cada repositório está rodando em seu próprio terminal.'));
  }

  getValidRepos() {
    const validRepos = [];
    
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
    }

    return validRepos;
  }

  getColorForRepo(repoName) {
    const colors = ['cyan', 'magenta', 'green', 'yellow', 'blue', 'red'];
    const index = repoName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  }

  async lint() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    const validRepos = this.getValidRepos();
    if (validRepos.length === 0) return;

    console.log(chalk.blue('🐙 Abrindo lint em terminal separado para cada projeto...\n'));

    let openedCount = 0;

    for (const repo of validRepos) {
      // Verificar se tem script de lint
      const packageJsonPath = path.join(repo.repoPath, 'package.json');
      let hasLint = false;
      let lintCommand = 'yarn lint';

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const scripts = packageJson.scripts || {};
        
        if (scripts.lint) {
          hasLint = true;
          // Usar yarn conforme política do octopus
          lintCommand = this.buildCommand('yarn lint', repo);
        }
      }

      if (!hasLint) {
        console.log(chalk.yellow(`⚠️  ${repo.name}: Sem script de lint configurado`));
        continue;
      }

      console.log(chalk.cyan(`🚀 Abrindo lint para ${repo.name}`));

      try {
        await this.openTerminalImproved(`Lint-${repo.name}`, repo.repoPath, lintCommand);
        openedCount++;
      } catch (error) {
        console.error(chalk.red(`⚠️  Erro ao abrir terminal para ${repo.name}: ${error.message}`));
      }
    }

    if (openedCount > 0) {
      console.log(chalk.green(`\n✅ ${openedCount} terminal(s) de lint aberto(s)!`));
      console.log(chalk.blue('💡 Cada projeto está executando lint em seu próprio terminal.'));
    } else {
      console.log(chalk.yellow('\n⚠️  Nenhum projeto com lint foi encontrado.'));
    }
  }

  async test() {
    if (!this.config) {
      console.log(chalk.red('❌ Execute "oct init" primeiro!'));
      return;
    }

    const validRepos = this.getValidRepos();
    if (validRepos.length === 0) return;

    console.log(chalk.blue('🐙 Abrindo testes em terminal separado para cada projeto...\n'));

    let openedCount = 0;

    for (const repo of validRepos) {
      // Verificar se tem script de test
      const packageJsonPath = path.join(repo.repoPath, 'package.json');
      let hasTest = false;
      let testCommand = 'yarn test';

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const scripts = packageJson.scripts || {};
        
        if (scripts.test && !scripts.test.includes('no test specified')) {
          hasTest = true;
          // Usar yarn conforme política do octopus
          testCommand = this.buildCommand('yarn test', repo);
        }
      }

      if (!hasTest) {
        console.log(chalk.yellow(`⚠️  ${repo.name}: Sem testes configurados ou disponíveis`));
        continue;
      }

      console.log(chalk.cyan(`🚀 Abrindo testes para ${repo.name}`));

      try {
        await this.openTerminalImproved(`Test-${repo.name}`, repo.repoPath, testCommand);
        openedCount++;
      } catch (error) {
        console.error(chalk.red(`⚠️  Erro ao abrir terminal para ${repo.name}: ${error.message}`));
      }
    }

    if (openedCount > 0) {
      console.log(chalk.green(`\n✅ ${openedCount} terminal(s) de teste aberto(s)!`));
      console.log(chalk.blue('💡 Cada projeto está executando testes em seu próprio terminal.'));
      console.log(chalk.gray('💡 Você pode usar watch mode, interromper, ou executar testes específicos.'));
    } else {
      console.log(chalk.yellow('\n⚠️  Nenhum projeto com testes foi encontrado.'));
    }
  }

  async android() {
    console.log(chalk.blue('🤖 Iniciando Android para o Host App...\n'));
    
    const validRepos = this.getValidRepos();
    const hostRepo = validRepos.find(repo => repo.isHost);
    
    if (!hostRepo) {
      console.log(chalk.red('❌ Host app não encontrado! Verifique a configuração.'));
      return;
    }

    console.log(chalk.cyan(`📱 Executando Android no Host: ${hostRepo.name}`));
    
    try {
      console.log(chalk.blue(`� Preparando build Android para ${hostRepo.name}...`));
      
      // Determinar comando correto baseado no prefix
      const androidCommand = this.buildCommand('yarn android', hostRepo);
      
      console.log(chalk.cyan(`🔧 Comando que será executado: ${androidCommand}`));
      
      // SEMPRE abrir terminal para build - permite acompanhamento visual
      console.log(chalk.blue(`� Abrindo terminal para build Android...`));
      await this.openTerminalImproved(`Android-Build-${hostRepo.name}`, hostRepo.repoPath, androidCommand);
      
      // Abrir terminal de logs Android (com delay para não conflitar com build)
      setTimeout(async () => {
        try {
          console.log(chalk.blue(`📋 Abrindo terminal para logs Android...`));
          
          // Comando de log com prefix na pasta do Host
          let logCommand;
          if (hostRepo.prefix) {
            logCommand = `yarn ${hostRepo.prefix} react-native log-android`;
          } else {
            logCommand = 'yarn react-native log-android';
          }
          console.log(chalk.cyan(`🔧 Comando de log: ${logCommand}`));
          
          // Executar na pasta do Host
          await this.openTerminalImproved(`Android-Logs-${hostRepo.name}`, hostRepo.repoPath, logCommand);
          console.log(chalk.green(`✅ Terminal de logs Android aberto!`));
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Não foi possível abrir logs Android: ${error.message}`));
        }
      }, 3000);
      
      console.log(chalk.green('\n✅ Build Android iniciado!'));
      console.log(chalk.cyan('📱 Terminal de build: Acompanhe o progresso em tempo real'));
      console.log(chalk.cyan('📋 Terminal de logs: Será aberto em 3 segundos'));
      console.log(chalk.blue('\n💡 Dicas importantes:'));
      console.log(chalk.gray('   • Certifique-se de ter um emulador rodando ou device conectado'));
      console.log(chalk.gray('   • O build pode demorar alguns minutos na primeira vez'));
      console.log(chalk.gray('   • Monitore ambos os terminais para possíveis erros'));
    } catch (error) {
      console.error(chalk.red(`❌ Erro ao abrir Android: ${error.message}`));
    }
  }

  async ios() {
    console.log(chalk.blue('🍎 Iniciando iOS para o Host App...\n'));
    
    const validRepos = this.getValidRepos();
    const hostRepo = validRepos.find(repo => repo.isHost);
    
    if (!hostRepo) {
      console.log(chalk.red('❌ Host app não encontrado! Verifique a configuração.'));
      return;
    }

    console.log(chalk.cyan(`📱 Executando iOS no Host: ${hostRepo.name}`));
    
    try {
      console.log(chalk.blue(`� Preparando build iOS para ${hostRepo.name}...`));
      
      // Determinar comando correto baseado no prefix
      const iosCommand = this.buildCommand('yarn ios', hostRepo);
      
      console.log(chalk.cyan(`🔧 Comando que será executado: ${iosCommand}`));
      
      // SEMPRE abrir terminal para build - permite acompanhamento visual
      console.log(chalk.blue(`� Abrindo terminal para build iOS...`));
      await this.openTerminalImproved(`iOS-Build-${hostRepo.name}`, hostRepo.repoPath, iosCommand);
      
      // Abrir terminal de logs iOS (com delay para não conflitar com build)
      setTimeout(async () => {
        try {
          console.log(chalk.blue(`📋 Abrindo terminal para logs iOS...`));
          
          // Comando de log com prefix na pasta do Host
          let logCommand;
          if (hostRepo.prefix) {
            logCommand = `yarn ${hostRepo.prefix} react-native log-ios`;
          } else {
            logCommand = 'yarn react-native log-ios';
          }
          console.log(chalk.cyan(`🔧 Comando de log: ${logCommand}`));
          
          // Executar na pasta do Host
          await this.openTerminalImproved(`iOS-Logs-${hostRepo.name}`, hostRepo.repoPath, logCommand);
          console.log(chalk.green(`✅ Terminal de logs iOS aberto!`));
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Não foi possível abrir logs iOS: ${error.message}`));
        }
      }, 3000);
      
      console.log(chalk.green('\n✅ Build iOS iniciado!'));
      console.log(chalk.cyan('📱 Terminal de build: Acompanhe o progresso em tempo real'));
      console.log(chalk.cyan('📋 Terminal de logs: Será aberto em 3 segundos'));
      console.log(chalk.blue('\n💡 Dicas importantes:'));
      console.log(chalk.gray('   • Certifique-se de ter o Xcode e simulador configurados'));
      console.log(chalk.gray('   • O build pode demorar alguns minutos na primeira vez'));
      console.log(chalk.gray('   • Monitore ambos os terminais para possíveis erros'));
    } catch (error) {
      console.error(chalk.red(`❌ Erro ao abrir iOS: ${error.message}`));
    }
  }

  async updateSdk(version) {
    // Carregar configuração do SDK
    const sdkConfigPath = path.join(__dirname, '../config/sdk-config.json');
    let sdkConfig;
    
    try {
      sdkConfig = JSON.parse(fs.readFileSync(sdkConfigPath, 'utf8'));
    } catch (error) {
      console.log(chalk.red('❌ Erro ao carregar configuração do SDK. Usando padrão.'));
      sdkConfig = {
        sdkDependency: '@drbf17/react-native-webview',
        updateCommands: {
          yarn: ['yarn install', 'yarn fix-dependencies', 'yarn install'],
          npm: ['npm install', 'npm run fix-dependencies', 'npm install']
        }
      };
    }
    
    const sdkName = sdkConfig.sdkDependency;
    console.log(chalk.blue(`🔄 Atualizando SDK ${sdkName} para versão ${version}...\n`));
    
    const validRepos = this.getValidRepos();
    if (validRepos.length === 0) return;

    const { Listr } = require('listr2');
    
    const tasks = new Listr([
      {
        title: 'Atualizando dependência com yarn add',
        task: async (ctx, task) => {
          const updateTasks = validRepos.map(repo => ({
            title: `${repo.name}: yarn add ${sdkName}@${version} --dev`,
            task: async () => {
              try {
                // Comando para adicionar/atualizar a dependência
                const addCommand = `add ${sdkName}@${version} --dev`;
                const fullAddCmd = this.buildCommand(`yarn ${addCommand}`, repo);
                const addCmdParts = fullAddCmd.split(' ');
                
                await this.runCommand(addCmdParts[0], addCmdParts.slice(1), repo.repoPath, { timeout: 180000 });
              } catch (error) {
                throw new Error(`Erro ao atualizar dependência em ${repo.name}: ${error.message}`);
              }
            }
          }));

          return task.newListr(updateTasks, { concurrent: true });
        }
      },
      {
        title: 'Executando comandos de finalização sequencialmente',
        task: async (ctx, task) => {
          const finalizationTasks = [];
          
          for (const repo of validRepos) {
            // Comandos de finalização em ordem específica
            const commands = ['yarn fix-dependencies', 'yarn install'];

            commands.forEach(cmd => {
              const fullCmd = this.buildCommand(cmd, repo);
              const cmdParts = fullCmd.split(' ');
              
              finalizationTasks.push({
                title: `${repo.name}: ${fullCmd}`,
                task: async () => {
                  try {
                    await this.runCommand(cmdParts[0], cmdParts.slice(1), repo.repoPath, { timeout: 180000 });
                  } catch (error) {
                    if (cmd.includes('fix-dependencies')) {
                      // fix-dependencies pode não existir, não é erro crítico
                      console.log(chalk.yellow(`⚠️  ${repo.name}: ${fullCmd} não disponível`));
                    } else {
                      throw error;
                    }
                  }
                }
              });
            });
          }

          return task.newListr(finalizationTasks, { concurrent: false }); // Sequencial
        }
      }
    ], {
      showSubtasks: true,
      showErrorMessage: true
    });

    try {
      await tasks.run();
      console.log(chalk.green(`\n✅ SDK ${sdkName} atualizado para v${version} com sucesso!`));
      console.log(chalk.blue('💡 Todos os módulos foram atualizados e dependências reinstaladas.'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Erro durante atualização do SDK: ${error.message}`));
    }
  }

  async startWithConcurrently() {
    console.log(chalk.blue('🐙 Iniciando com Concurrently (modo paralelo)...\n'));
    
    const validRepos = this.getValidRepos();
    if (validRepos.length === 0) return;

    const commands = validRepos.map(repo => {
      const startCommand = this.buildCommand('yarn start', repo);
      
      return {
        command: startCommand,
        name: repo.name,
        cwd: repo.repoPath,
        prefixColor: this.getColorForRepo(repo.name)
      };
    });

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
      apps: validRepos.map(repo => {
        const startCommand = this.buildCommand('yarn start', repo);
        const [script, ...args] = startCommand.split(' ');
        return {
          name: repo.name,
          cwd: repo.repoPath,
          script: script,
          args: args.join(' '),
          env: {
            PORT: repo.port,
            NODE_ENV: 'development'
          },
          watch: false,
          ignore_watch: ['node_modules', 'dist', 'build'],
          restart_delay: 1000,
          max_restarts: 10
        };
      })
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
        const startCommand = this.buildCommand('yarn start', repo);
        await this.runCommand('tmux', ['send-keys', '-t', `${sessionName}:${repo.name}`, startCommand, 'Enter'], process.cwd());
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
        const startCommand = this.buildCommand('yarn start', repo);
        await this.openTerminal(repo.name, repoPath, startCommand);
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
        tasks: [
          {
            label: "🐙 Octopus - Start All",
            type: "shell",
            command: "oct",
            args: ["start"],
            group: "build",
            presentation: {
              echo: true,
              reveal: "always",
              focus: true,
              panel: "dedicated",
              showReuseMessage: false,
              clear: true
            },
            problemMatcher: []
          },
          {
            label: "🔍 Octopus - Lint All",
            type: "shell", 
            command: "oct",
            args: ["lint"],
            group: "test",
            presentation: {
              echo: true,
              reveal: "always",
              focus: false,
              panel: "new",
              showReuseMessage: false
            },
            problemMatcher: []
          },
          {
            label: "🧪 Octopus - Test All",
            type: "shell",
            command: "oct", 
            args: ["test"],
            group: "test",
            presentation: {
              echo: true,
              reveal: "always",
              focus: false,
              panel: "new",
              showReuseMessage: false
            },
            problemMatcher: []
          },
          {
            label: "📦 Octopus - Install All",
            type: "shell",
            command: "oct",
            args: ["install"],
            group: "build",
            presentation: {
              echo: true,
              reveal: "always",
              focus: true,
              panel: "dedicated",
              showReuseMessage: false
            },
            problemMatcher: []
          }
        ]
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

    // Criar keybindings sugeridos
    await this.createVSCodeKeybindings();

    console.log(chalk.green(`✅ Workspace VS Code criado: ${path.basename(workspaceFile)}`));
    console.log(chalk.blue('💡 Abra o workspace: File > Open Workspace from File'));
    console.log(chalk.blue('💡 Atalhos sugeridos criados em .vscode/keybindings.json'));
  }

  async createVSCodeKeybindings() {
    const vscodeDir = path.join(process.cwd(), '.vscode');
    const keybindingsFile = path.join(vscodeDir, 'keybindings.json');

    // Criar diretório se não existir
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const keybindings = [
      {
        key: "ctrl+shift+s",
        command: "workbench.action.tasks.runTask",
        args: "🐙 Octopus - Start All",
        when: "!inDebugMode"
      },
      {
        key: "ctrl+shift+l", 
        command: "workbench.action.tasks.runTask",
        args: "🔍 Octopus - Lint All"
      },
      {
        key: "ctrl+shift+t",
        command: "workbench.action.tasks.runTask", 
        args: "🧪 Octopus - Test All"
      },
      {
        key: "ctrl+shift+i",
        command: "workbench.action.tasks.runTask",
        args: "📦 Octopus - Install All"
      }
    ];

    fs.writeFileSync(keybindingsFile, JSON.stringify(keybindings, null, 2));
    
    console.log(chalk.yellow('⌨️  Atalhos de teclado criados:'));
    console.log(chalk.gray('   • Ctrl+Shift+S: Start All Services'));
    console.log(chalk.gray('   • Ctrl+Shift+L: Lint All Projects'));
    console.log(chalk.gray('   • Ctrl+Shift+T: Test All Projects'));
    console.log(chalk.gray('   • Ctrl+Shift+I: Install All Dependencies'));
  }

  async runCommand(command, args, cwd, options = {}) {
    // Log detalhado do comando sendo executado
    const fullCmd = `${command} ${args.join(' ')}`;
    console.log(chalk.blue(`🔧 Executando: ${fullCmd}`));
    console.log(chalk.gray(`   📁 Diretório: ${cwd}`));
    
    try {
      const result = await execa(command, args, {
        cwd,
        shell: true,
        timeout: options.timeout || 300000, // 5 minutos default
        ...options
      });
      
      console.log(chalk.green(`✅ Comando concluído: ${fullCmd}`));
      return result;
    } catch (error) {
      // Melhor tratamento de erro com informações detalhadas
      console.log(chalk.red(`❌ Comando falhou: ${fullCmd}`));
      console.log(chalk.red(`   Exit Code: ${error.exitCode}`));
      console.log(chalk.red(`   Stderr: ${error.stderr}`));
      
      const errorInfo = {
        command: fullCmd,
        cwd,
        exitCode: error.exitCode,
        stderr: error.stderr,
        stdout: error.stdout
      };
      
      throw new Error(`Command failed: ${errorInfo.command}\nExit code: ${errorInfo.exitCode}\nError: ${errorInfo.stderr || error.message}`);
    }
  }

  async openTerminalImproved(name, cwd, command) {
    console.log(chalk.blue(`🔧 Tentando abrir terminal: ${name}`));
    console.log(chalk.gray(`   📁 Diretório: ${cwd}`));
    console.log(chalk.gray(`   ⚡ Comando: ${command}`));
    console.log(chalk.gray(`   🖥️  Platform: ${process.platform}`));
    
    // Verificar se o diretório existe antes de tentar abrir terminal
    if (!fs.existsSync(cwd)) {
      console.error(chalk.red(`❌ Diretório não existe: ${cwd}`));
      console.log(chalk.yellow(`💡 Execute 'yarn oct init' ou clone o repositório manualmente`));
      return;
    }
    
    return new Promise((resolve) => {
      try {
        const platform = process.platform;
        let terminalCommand;
        let args;

        if (platform === 'darwin') {
          // macOS - AppleScript melhorado com tratamento de erro e titulo
          const appleScript = `
            tell application "Terminal"
              activate
              set newTab to do script "cd '${cwd.replace(/'/g, "'\\''")}'"
              delay 1
              set custom title of newTab to "${name}"
              do script "clear && echo '🐙 ${name} - Executando comando...' && echo 'Comando: ${command}' && echo '----------------------------------------' && ${command}" in newTab
            end tell
          `;
          terminalCommand = 'osascript';
          args = ['-e', appleScript];
          console.log(chalk.cyan(`🍎 Usando Terminal.app no macOS`));
        } else if (platform === 'win32') {
          // Windows - usar arquivo batch temporário para evitar problemas com concatenação
          const tempDir = require('os').tmpdir();
          const batchFile = path.join(tempDir, `octopus-${name.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}.bat`);
          
          const batchContent = `@echo off
cd /d "${cwd}"
echo [OCTOPUS] ${name} - Iniciando...
echo Comando: ${command}
echo ========================================
${command}
pause`;

          // Criar arquivo batch temporário
          fs.writeFileSync(batchFile, batchContent);
          
          // Limpar arquivo batch depois de 30 segundos
          setTimeout(() => {
            try {
              if (fs.existsSync(batchFile)) {
                fs.unlinkSync(batchFile);
              }
            } catch (error) {
              // Ignorar erros de limpeza
            }
          }, 30000);
          
          terminalCommand = 'cmd';
          args = ['/c', 'start', `"${name}"`, 'cmd', '/k', `"${batchFile}"`];
          
          console.log(chalk.cyan(`🪟 Usando CMD no Windows com arquivo batch`));
          console.log(chalk.gray(`   Arquivo batch: ${batchFile}`));
        } else {
          // Linux - tentar múltiplos terminais com títulos
          const terminals = [
            ['gnome-terminal', ['--title', name, '--working-directory', cwd, '--', 'bash', '-c', `clear && echo '🐙 ${name} - Executando comando...' && echo 'Comando: ${command}' && echo '----------------------------------------' && ${command}; exec bash`]],
            ['xterm', ['-title', name, '-e', `bash -c "cd '${cwd}' && clear && echo '🐙 ${name} - Executando comando...' && echo 'Comando: ${command}' && echo '----------------------------------------' && ${command}; exec bash"`]],
            ['konsole', ['--workdir', cwd, '--title', name, '-e', `bash -c "clear && echo '🐙 ${name} - Executando comando...' && echo 'Comando: ${command}' && echo '----------------------------------------' && ${command}; exec bash"`]]
          ];
          
          let terminalFound = false;
          for (const [terminal, termArgs] of terminals) {
            try {
              console.log(chalk.cyan(`🐧 Tentando terminal: ${terminal}`));
              terminalCommand = terminal;
              args = termArgs;
              terminalFound = true;
              break;
            } catch (e) {
              console.log(chalk.yellow(`⚠️  ${terminal} não disponível`));
              continue;
            }
          }
          
          if (!terminalFound) {
            console.warn(chalk.red(`❌ Nenhum terminal compatível encontrado para ${name}`));
            console.log(chalk.yellow(`💡 Instale: sudo apt install gnome-terminal`));
            resolve();
            return;
          }
        }

        console.log(chalk.blue(`🚀 Executando: ${terminalCommand} ${args.join(' ')}`));
        
        // Executar comando com timeout
        const childProcess = spawn(terminalCommand, args, {
          stdio: ['ignore', 'pipe', 'pipe'], // Capturar output para debug
          detached: true,  // Processo independente
          shell: platform === 'win32'
        });

        // Capturar stderr para debug
        let errorOutput = '';
        childProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        // Timeout para não travar
        const timeout = setTimeout(() => {
          console.log(chalk.green(`✅ Terminal ${name} processado (timeout)`));
          resolve();
        }, 5000);

        childProcess.on('spawn', () => {
          clearTimeout(timeout);
          console.log(chalk.green(`✅ Terminal ${name} aberto com sucesso! (PID: ${childProcess.pid})`));
          resolve();
        });

        childProcess.on('error', (error) => {
          clearTimeout(timeout);
          console.error(chalk.red(`❌ Erro ao abrir terminal ${name}: ${error.message}`));
          if (errorOutput) {
            console.error(chalk.red(`   Stderr: ${errorOutput}`));
          }
          
          // Tentar fallback simples
          console.log(chalk.yellow(`🔄 Tentando fallback para ${name}...`));
          this.openTerminalFallback(name, cwd, command).then(resolve);
        });

        childProcess.on('close', (code) => {
          if (code !== 0) {
            console.log(chalk.yellow(`⚠️  Terminal ${name} fechou com código: ${code}`));
            if (errorOutput) {
              console.log(chalk.red(`   Stderr: ${errorOutput}`));
            }
          }
        });

        // Desanexar processo para não afetar o octopus
        if (childProcess.pid) {
          childProcess.unref();
        }

      } catch (error) {
        console.error(chalk.red(`❌ Erro crítico ao abrir terminal ${name}: ${error.message}`));
        console.log(chalk.yellow(`🔄 Tentando fallback...`));
        this.openTerminalFallback(name, cwd, command).then(resolve);
      }
    });
  }

  // Método de fallback mais simples para abrir terminais
  async openTerminalFallback(name, cwd, command) {
    console.log(chalk.yellow(`🔄 Executando fallback para terminal: ${name}`));
    
    try {
      const platform = process.platform;
      
      if (platform === 'darwin') {
        // Fallback simples para macOS - apenas executar no terminal atual
        console.log(chalk.blue(`🍎 Fallback macOS: executando no terminal atual`));
        console.log(chalk.cyan(`📂 cd ${cwd}`));
        console.log(chalk.cyan(`⚡ ${command}`));
        console.log(chalk.gray(`💡 Execute manualmente os comandos acima em um novo terminal`));
      } else if (platform === 'win32') {
        // Fallback para Windows - comando mais simples
        console.log(chalk.blue(`🪟 Fallback Windows: tentando comando mais simples...`));
        
        // Verificar se o diretório existe
        if (!fs.existsSync(cwd)) {
          console.error(chalk.red(`❌ Diretório não existe: ${cwd}`));
          console.log(chalk.yellow(`💡 Verifique se o repositório foi clonado corretamente`));
          return;
        }
        
        // Criar arquivo batch temporário para fallback também
        const { spawn } = require('child_process');
        const tempDir = require('os').tmpdir();
        const fallbackBatchFile = path.join(tempDir, `octopus-fallback-${name.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}.bat`);
        
        const fallbackBatchContent = `@echo off
echo === OCTOPUS FALLBACK - ${name} ===
cd /d "${cwd}"
echo Diretorio atual: %CD%
echo Comando: ${command}
echo.
${command}
echo.
echo Pressione qualquer tecla para fechar...
pause >nul`;

        fs.writeFileSync(fallbackBatchFile, fallbackBatchContent);
        
        // Limpar arquivo batch fallback depois de 30 segundos
        setTimeout(() => {
          try {
            if (fs.existsSync(fallbackBatchFile)) {
              fs.unlinkSync(fallbackBatchFile);
            }
          } catch (error) {
            // Ignorar erros de limpeza
          }
        }, 30000);
        
        console.log(chalk.gray(`   Arquivo batch fallback: ${fallbackBatchFile}`));
        
        spawn('cmd', ['/c', 'start', `"${name} (Fallback)"`, 'cmd', '/k', `"${fallbackBatchFile}"`], {
          detached: true,
          stdio: 'ignore'
        });
      } else {
        // Fallback para Linux - instruções manuais
        console.log(chalk.blue(`🐧 Fallback Linux: instruções manuais`));
        console.log(chalk.cyan(`📂 cd ${cwd}`));
        console.log(chalk.cyan(`⚡ ${command}`));
        console.log(chalk.gray(`💡 Execute manualmente os comandos acima em um novo terminal`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Fallback também falhou: ${error.message}`));
      console.log(chalk.yellow(`💡 Comandos para execução manual:`));
      console.log(chalk.cyan(`   cd ${cwd}`));
      console.log(chalk.cyan(`   ${command}`));
    }
  }

  // Método para tentar diferentes estratégias de comando com fallback automático
  async runCommandWithFallback(repo, action, options = {}) {
    const strategies = [
      // Estratégia 1: Comando direto com prefix (ex: "yarn host install") - MAIS COMUM
      {
        name: 'Comando com prefix',
        command: `yarn ${repo.prefix} ${action}`,
        check: () => true // Sempre tentar primeiro - é o mais comum para monorepos
      },
      // Estratégia 2: Script específico (ex: "host:install")
      {
        name: 'Script específico',
        command: `yarn ${repo.prefix}:${action}`,
        check: () => this.checkScriptExists(`${repo.prefix}:${action}`, repo.repoPath)
      },
      // Estratégia 3: Yarn workspace
      {
        name: 'Yarn workspace',
        command: `yarn workspace ${repo.prefix} ${action}`,
        check: () => true // Tentar se as outras não funcionarem
      },
      // Estratégia 4: Comando direto no diretório (fallback final)
      {
        name: 'Comando direto',
        command: `yarn ${action}`,
        check: () => true
      }
    ];

    for (const strategy of strategies) {
      if (!strategy.check()) {
        console.log(chalk.gray(`⏭️  [${repo.name}] Pulando estratégia: ${strategy.name}`));
        continue;
      }

      console.log(chalk.blue(`🎯 [${repo.name}] Tentando estratégia: ${strategy.name}`));
      console.log(chalk.gray(`   Comando: ${strategy.command}`));

      try {
        const [cmd, ...args] = strategy.command.split(' ');
        await this.runCommand(cmd, args, repo.repoPath, options);
        
        console.log(chalk.green(`✅ [${repo.name}] Sucesso com estratégia: ${strategy.name}`));
        return; // Sucesso, não precisa tentar outras estratégias
        
      } catch (error) {
        console.log(chalk.red(`❌ [${repo.name}] Falhou estratégia: ${strategy.name}`));
        console.log(chalk.red(`   Erro: ${error.message.split('\n')[0]}`));
      }
    }

    // Se chegou aqui, todas as estratégias falharam
    throw new Error(`Todas as estratégias falharam para ${repo.name} com prefix '${repo.prefix}'`);
  }


}

module.exports = Octopus;