# 🐙 Octopus - Multi-Repository Manager

Ferramenta completa para gerenciar múltiplos repositórios de micro apps React Native de forma cross-platform.

## 🌍 Compatibilidade

✅ **macOS** - Suporte completo com AppleScript
✅ **Windows** - Suporte completo com cmd
✅ **Linux** - Suporte completo com gnome-terminal

## 🚀 Instalação

```bash
cd octopus
yarn install
yarn link  # Para usar o comando 'oct' globalmente
```

## 📋 Comandos Disponíveis

### 🔧 Configuração Inicial
```bash
oct init
```
- 📝 Define nome do projeto para workspace
- 📋 Apresenta lista de repositórios padrão
- ✅ Permite seleção interativa no terminal
- � Clona repositórios automaticamente
- �📦 Instala dependências nos repos existentes
- ⚙️ Cria configuração personalizada
- 🔧 Gera tasks do VS Code automaticamente
- 🗂️ Cria workspace VS Code com todos os repositórios

### 📥 Clonagem
```bash
oct clone
```
- Clona todos os repositórios selecionados
- Coloca no diretório pai do Octopus
- Pula repositórios já existentes

### 🌿 Controle de Branches
```bash
oct checkout <branch-name>          # Checkout + pull em todos os repos
oct new-branch <name> [base-branch] # Cria nova branch em todos os repos
```

### 📦 Gerenciamento Yarn
```bash
oct install  # yarn install em todos (mesmo terminal)
oct start    # yarn start em todos (terminais separados)
```

### 📊 Informações
```bash
oct status   # Status de todos os repositórios
oct list     # Lista repositórios configurados
```

## 🗂️ Estrutura de Arquivos

```
octopus/
├── bin/oct                    # CLI executável
├── src/octopus.js            # Classe principal
├── config/
│   ├── default-repos.json    # Repositórios padrão
│   └── octopus-config.json   # Configuração atual (criado pelo init)
└── .vscode/tasks.json        # Tasks VS Code (criado pelo init)
```

## ⚙️ Configuração de Repositórios

O arquivo `config/default-repos.json` contém:

```json
{
  "repositories": [
    {
      "name": "Host",
      "url": "https://github.com/user/Host-MicroApp.git",
      "localPath": "../Host",
      "active": true,
      "port": 8081,
      "priority": 1,
      "description": "Host application - Main container"
    }
  ],
  "settings": {
    "defaultBranch": "main",
    "autoInstall": true,
    "createVSCodeTasks": true,
    "terminalType": "system"
  }
}
```

### Propriedades dos Repositórios:
- **name**: Nome do repositório
- **url**: URL Git remota
- **localPath**: Caminho local relativo
- **active**: Se deve ser incluído por padrão
- **port**: Porta do servidor de desenvolvimento
- **priority**: Ordem de execução
- **description**: Descrição do micro app

## 🖥️ Integração VS Code

Após `oct init`, você terá:

### 📋 **Tasks Automatizadas**
1. **Cmd+Shift+P** (macOS) ou **Ctrl+Shift+P** (Windows/Linux)
2. Digite **"Tasks: Run Task"**
3. Selecione **"Octopus - Start All"**

### 🗂️ **Workspace Completo**
- Arquivo `[projeto]-workspace.code-workspace` gerado automaticamente
- **File > Open Workspace from File** para abrir
- Todos os repositórios organizados em um workspace
- Configurações otimizadas para desenvolvimento

Cada repositório rodará em seu próprio terminal integrado! 🚀

## 🔄 Fluxo de Trabalho Típico

### Primeira vez:
```bash
oct init     # Configura, clona e instala tudo automaticamente!
# ✅ Clone automático opcional
# ✅ Instalação automática opcional  
# ✅ Workspace VS Code criado
```

### Desenvolvimento diário:
```bash
oct checkout develop    # Atualiza todos para develop
oct start              # Inicia todos os servidores
```

### Nova feature:
```bash
oct new-branch feature/login develop  # Cria branch em todos
# ... desenvolver ...
oct install                           # Instala novas dependências
```

## 🔄 Usando o Octopus em Outros Projetos

### 1. Preparação
```bash
# Copie o Octopus para seu novo projeto
cp -r /path/to/octopus /seu-novo-projeto/octopus
cd /seu-novo-projeto/octopus
yarn install
```

### 2. Personalização dos Repositórios
**EDITE APENAS** o arquivo `config/default-repos.json`:

```json
{
  "repositories": [
    {
      "name": "Frontend", 
      "url": "https://github.com/seu-usuario/frontend.git",
      "localPath": "frontend",
      "active": true,
      "port": 3000,
      "priority": 1,
      "description": "Aplicação frontend principal"
    },
    {
      "name": "Backend",
      "url": "https://github.com/seu-usuario/backend.git",
      "localPath": "backend", 
      "active": true,
      "port": 8000,
      "priority": 2,
      "description": "API backend"
    }
  ],
  "settings": {
    "defaultBranch": "main",
    "autoInstall": true,
    "createVSCodeTasks": true,
    "terminalType": "system"
  }
}
```

### 3. Estrutura Recomendada
```
seu-novo-projeto/
├── octopus/                    # Ferramenta Octopus
│   ├── config/
│   │   └── default-repos.json  # ← EDITE ESTE ARQUIVO
│   ├── src/octopus.js
│   └── bin/oct
├── frontend/                   # Repositório clonado
├── backend/                    # Repositório clonado
└── .vscode/
    └── tasks.json             # Gerado automaticamente
```

### 4. Inicializar
```bash
# No diretório raiz (onde ficam os repositórios)
cd /seu-novo-projeto
oct init
```

## 🚨 Arquivos Importantes para .gitignore

```gitignore
# No .gitignore do seu projeto principal
octopus/config/octopus-config.json   # Arquivo gerado, não versionar!

# No .gitignore do octopus
node_modules/
yarn-debug.log*
yarn-error.log*
config/octopus-config.json          # Gerado pelo 'oct init'
```

⚠️ **Importante**: O arquivo `octopus-config.json` é gerado automaticamente pelo comando `oct init`. Apenas o `default-repos.json` deve ser versionado como template.

## 🎯 Vantagens

✅ **Cross-platform**: Funciona no macOS, Windows e Linux  
✅ **Configuração única**: Um comando configura tudo  
✅ **Reutilizável**: Use em qualquer projeto modificando apenas default-repos.json  
✅ **Seleção flexível**: Escolha quais repos usar  
✅ **Sincronização Git**: Operações em todos os repos simultaneamente  
✅ **Integração VS Code**: Tasks automáticas  
✅ **Terminais organizados**: Um terminal por micro app  
✅ **Status centralizado**: Veja o estado de todos os repos  

## 📝 Exemplo de Uso

```bash
# Configuração inicial
oct init
# ✅ Selecione: Host, Auth, Home, Contas
# ✅ Instalar dependências? Sim
# ✅ Tasks VS Code criadas!

# Clonagem (se necessário)
oct clone
# ✅ 4 repositórios clonados

# Desenvolvimento
oct checkout main
oct new-branch feature/new-ui main
oct start
# ✅ 4 terminais abertos, cada um com seu micro app

# Status
oct status
# 🟢 Host - Ativo - http://localhost:8081
# 🟢 Auth - Ativo - http://localhost:8084
# 🟢 Home - Ativo - http://localhost:8083
# 🟢 Contas - Ativo - http://localhost:8082
```

## � Solução de Problemas Cross-Platform

### Windows
- **Terminal não abre**: Certifique-se de ter o `cmd` no PATH
- **Encoding**: Use PowerShell se houver problemas com acentos

### macOS  
- **AppleScript**: Permita execução de scripts se solicitado
- **Terminal**: O sistema abrirá automaticamente o Terminal.app

### Linux
- **gnome-terminal**: Instale se não estiver disponível: `sudo apt install gnome-terminal`
- **Alternativas**: Pode usar `xterm` ou outros terminais compatíveis

## 🔧 Personalização Avançada

Para usar o Octopus em diferentes tipos de projeto:

1. **Edite apenas `default-repos.json`** - Nunca modifique `octopus-config.json` manualmente
2. **Use caminhos relativos** - Os `localPath` são relativos ao diretório onde executa `oct init`
3. **Configure prioridades** - Repos com priority=1 iniciam primeiro
4. **Teste em diferentes SOs** - A ferramenta detecta automaticamente o sistema

---

**🐙 Octopus - Gerencie seus tentáculos com facilidade em qualquer plataforma!** ✨