# 🐙 Octopus - Multi-Repository Manager

Ferramenta CLI para gerenciar múltiplos repositórios React Native de forma eficiente e cross-platform.

## 🚀 Instalação e Uso

### 🖥️ Windows (PowerShell) - Instalação Automática
```powershell
# Opção 1: Script PowerShell (recomendado)
.\install-windows.ps1

# Opção 2: Script Batch
.\install-windows.bat
```

### 🖥️ Windows (PowerShell) - Instalação Manual
```powershell
# 1. Clone e setup do Octopus
git clone https://github.com/drbf17/octopus.git
cd octopus
yarn install
yarn link

# 2. Verificar se yarn está no PATH (essencial!)
# Se não estiver, adicione: C:\Users\{seu-usuario}\AppData\Local\Yarn\bin
$env:PATH += ";$env:LOCALAPPDATA\Yarn\bin"

# 3. Reiniciar PowerShell ou executar:
refreshenv

# 4. Testar comando
oct --help

# 5. Setup completo automatizado
oct init
```

### 🍎 macOS/Linux
```bash
# 1. Clone e setup do Octopus
git clone https://github.com/drbf17/octopus.git
cd octopus
yarn install
yarn link    # 🔗 Torna o comando 'oct' disponível globalmente

# 2. Setup completo automatizado  
oct init
```

> **⚠️ Windows:** Se `oct` não for reconhecido após `yarn link`, adicione o diretório Yarn ao PATH: `C:\Users\{seu-usuario}\AppData\Local\Yarn\bin`

## 📋 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `oct init` | **Setup completo**: clone + install + VS Code workspace |
| `oct clone` | Clona repositórios em falta |
| `oct install` | yarn/npm install em paralelo (todos repos) |
| `oct start` | Inicia todos os servidores em terminais separados |
| `oct lint` | Lint em terminais separados por projeto |
| `oct test` | Testes em terminais separados por projeto |
| `oct android` | 🤖 Build Android + logs em terminais separados |
| `oct ios` | 🍎 Build iOS + logs em terminais separados |
| `oct update-sdk <version>` | 🔄 Atualiza SDK configurado em todos os módulos |
| `oct checkout <branch>` | Checkout + pull em todos os repositórios |
| `oct new-branch <name> [base]` | Cria nova branch em todos os repos |
| `oct status` | Status Git de todos os repositórios |
| `oct list` | Lista repositórios configurados |

## � Exemplos de Uso

### Setup inicial completo
```bash
oct init
# ✅ Seleciona repositórios interativamente
# ✅ Clona automaticamente
# ✅ Instala dependências em paralelo  
# ✅ Cria workspace VS Code
# ✅ Configura tasks automáticas
```

### Desenvolvimento diário
```bash
oct checkout develop    # Atualiza todos para develop
oct start              # Inicia todos os servidores
# Use VS Code Tasks: Cmd+Shift+P → "Tasks: Run Task"
```

### Desenvolvimento nativo (Host app)
```bash
oct android            # 🤖 Abre 2 terminais: Build + Logs Android
oct ios               # 🍎 Abre 2 terminais: Build + Logs iOS
```

### Atualização de SDK
```bash
oct update-sdk 0.3.0  # 🔄 Atualiza SDK em todos os módulos
# ✅ Atualiza package.json → yarn install → yarn fix-dependencies → yarn install
```

### Nova feature
```bash
oct new-branch feature/login develop  # Cria branch em todos
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

## 🔧 Troubleshooting

### Windows: Comando 'oct' não reconhecido
```powershell
# 1. Use o script automático (recomendado)
.\install-windows.ps1

# 2. Ou configure manualmente:
# Verificar se yarn link funcionou
yarn global list

# 3. Adicionar Yarn bin ao PATH do usuário (SEM precisar de admin)
[Environment]::SetEnvironmentVariable('PATH', [Environment]::GetEnvironmentVariable('PATH', 'User') + ';' + $env:LOCALAPPDATA + '\Yarn\bin', 'User')

# 4. Reiniciar PowerShell e testar
oct --help

# 5. Alternativa: usar npx (funciona sempre)
npx oct init
```

### macOS/Linux: Comando não encontrado
```bash
# 1. Verificar se yarn está no PATH
which yarn

# 2. Verificar yarn global bin
yarn global bin

# 3. Adicionar ao PATH (se necessário)
echo 'export PATH="$(yarn global bin):$PATH"' >> ~/.bashrc
source ~/.bashrc
```

## 🔧 Sobre o Projeto

### Princípios
- **Simplicidade**: Um comando (`oct init`) configura tudo
- **Cross-platform**: funciona no macOS, Windows e Linux  
- **Inteligente**: detecta yarn/npm automaticamente
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