# 🐙 Octopus - Multi-Repository Manager

Ferramenta CLI para gerenciar múltiplos repositórios React Native de forma eficiente e cross-platform.

## 🚀 Instalação e Uso

### ✅ Universal (Windows/macOS/Linux)
```bash
# 1. Clone e setup do Octopus
git clone https://github.com/drbf17/octopus.git
cd octopus
yarn install

# 2. Setup completo automatizado  
yarn oct init

# 3. Uso diário
yarn oct start      # Inicia todos os servidores
yarn oct android    # Build Android + logs
yarn oct ios        # Build iOS + logs
```

> **💡 Simples:** Não precisa de `yarn link`, `PATH` ou privilégios administrativos!

## 📋 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `yarn oct init` | **Setup completo**: clone + install + VS Code workspace |
| `yarn oct clone` | Clona repositórios em falta |
| `yarn oct install` | yarn install em paralelo (todos repos) |
| `yarn oct start` | Inicia todos os servidores em terminais separados |
| `yarn oct lint` | Lint em terminais separados por projeto |
| `yarn oct test` | Testes em terminais separados por projeto |
| `yarn oct android` | 🤖 Build Android + logs em terminais separados |
| `yarn oct ios` | 🍎 Build iOS + logs em terminais separados |
| `yarn oct update-sdk <version>` | 🔄 Atualiza SDK configurado em todos os módulos |
| `yarn oct checkout <branch>` | Checkout + pull em todos os repositórios |
| `yarn oct new-branch <name> [base]` | Cria nova branch em todos os repos |
| `yarn oct status` | Status Git de todos os repositórios |
| `yarn oct list` | Lista repositórios configurados |

## � Exemplos de Uso

### Setup inicial completo
```bash
yarn oct init
# ✅ Seleciona repositórios interativamente
# ✅ Clona automaticamente
# ✅ Instala dependências em paralelo  
# ✅ Cria workspace VS Code
# ✅ Configura tasks automáticas
```

### Desenvolvimento diário
```bash
yarn oct checkout develop    # Atualiza todos para develop
yarn oct start              # Inicia todos os servidores
# Use VS Code Tasks: Cmd+Shift+P → "Tasks: Run Task"
```

### Desenvolvimento nativo (Host app)
```bash
yarn oct android            # 🤖 Abre 2 terminais: Build + Logs Android
yarn oct ios               # 🍎 Abre 2 terminais: Build + Logs iOS
```

### Atualização de SDK
```bash
yarn oct update-sdk 0.3.0  # 🔄 Atualiza SDK em todos os módulos
# ✅ Atualiza package.json → yarn install → yarn fix-dependencies → yarn install
```

### Nova feature
```bash
yarn oct new-branch feature/login develop  # Cria branch em todos
# ... desenvolvimento ...
oct lint               # Lint por projeto
oct test              # Testes por projeto
```

### 🖥️ VS Code Integration
Após `oct init`:
- **Workspace**: `{projeto}-workspace.code-workspace`
- **Tasks**: `Cmd+Shift+P` → `Tasks: Run Task`
- **Keybindings**: `Cmd+Shift+R` → Start All

## 📁 Estrutura de Projeto
```
meu-projeto/
├── .vscode/tasks.json                    # Tasks automáticas
├── meu-projeto-workspace.code-workspace  # VS Code workspace  
├── octopus/                             # CLI tool
├── Host/                                # Repositório clonado
├── Auth/                                # Repositório clonado
└── Home/                                # Repositório clonado
```

## 🔧 Sobre o Projeto

### Princípios
- **Simplicidade**: Um comando (`yarn oct init`) configura tudo
- **Cross-platform**: funciona no macOS, Windows e Linux  
- **Universal**: usa `yarn oct` que funciona em qualquer terminal
- **Integrado**: gera workspace e tasks do VS Code
- **Reutilizável**: facilmente adaptável para outros projetos

### Configuração do SDK (`config/sdk-config.json`)
```json
{
  "sdkDependency": "@drbf17/react-native-webview",
  "updateCommands": {
    "yarn": ["yarn install", "yarn fix-dependencies", "yarn install"],
    "npm": ["npm install", "npm run fix-dependencies", "npm install"]
  }
}
```

### Objetivos
- Eliminar setup manual repetitivo de múltiplos repositórios
- Centralizar operações Git em todos os repos simultaneamente
- Otimizar workflow de desenvolvimento React Native/micro apps
- Fornecer experiência consistente entre diferentes plataformas

### Configuração (`config/default-repos.json`)
```json
{
  "repositories": [
    {
      "name": "Host",
      "url": "https://github.com/user/host.git",
      "localPath": "Host", 
      "port": 8081,
      "active": true,
      "isHost": true,
      "description": "App principal React Native"
    }
  ],
  "settings": {
    "defaultBranch": "main",
    "autoInstall": true,
    "createVSCodeTasks": true
  }
}
```

### Compatibilidade
- ✅ **Package Manager**: Auto-detecção yarn/npm
- ✅ **Terminais**: AppleScript (macOS), CMD (Windows), gnome-terminal (Linux)
- ✅ **Git**: Simple-git para operações cross-platform  
- ✅ **Node.js**: Execa para execução robusta de processos

---

**🐙 Octopus** - Simplifique o gerenciamento de múltiplos repositórios React Native