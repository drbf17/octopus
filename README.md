# 🐙 Octopus - Multi-Repository Manager

Ferramenta completa para gerenciar múltiplos repositórios de micro apps React Native.

## 🚀 Instalação

```bash
cd octopus
npm install
npm link  # Para usar o comando 'oct' globalmente
```

## 📋 Comandos Disponíveis

### 🔧 Configuração Inicial
```bash
oct init
```
- Apresenta lista de repositórios padrão
- Permite seleção interativa no terminal
- Instala dependências nos repos existentes
- Cria configuração personalizada
- Gera tasks do VS Code automaticamente

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

### 📦 Gerenciamento NPM
```bash
oct install  # npm install em todos (mesmo terminal)
oct start    # npm start em todos (terminais separados)
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

Após `oct init`, você pode usar:

1. **Cmd+Shift+P** (macOS) ou **Ctrl+Shift+P** (Windows/Linux)
2. Digite **"Tasks: Run Task"**
3. Selecione **"Octopus - Start All"**

Cada repositório rodará em seu próprio terminal integrado! 🚀

## 🔄 Fluxo de Trabalho Típico

### Primeira vez:
```bash
oct init     # Configura e instala tudo
oct clone    # Clona os repositórios que faltam
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

## 🎯 Vantagens

✅ **Configuração única**: Um comando configura tudo  
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

## 🔧 Personalização

Para adicionar novos repositórios, edite `config/default-repos.json` e execute `oct init` novamente.

---

**🐙 Octopus - Gerencie seus tentáculos com facilidade!** ✨