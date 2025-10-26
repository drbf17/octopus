# 🐙 Octopus - Multi-Repository Manager

Ferramenta CLI para gerenciar múltiplos repositórios React Native de forma eficiente e cross-platform.

## 🚀 Instalação e Uso

```bash
# 1. Clone e setup do Octopus
git clone https://github.com/drbf17/octopus.git
cd octopus
yarn install
yarn link    # 🔗 Torna o comando 'oct' disponível globalmente

# 2. Setup completo automatizado  
oct init
```

> **💡 Importante:** O `yarn link` é essencial para que o comando `oct` funcione globalmente no terminal.

## 📋 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `oct init` | **Setup completo**: clone + install + VS Code workspace |
| `oct clone` | Clona repositórios em falta |
| `oct install` | yarn/npm install em paralelo (todos repos) |
| `oct start` | Inicia todos os servidores em terminais separados |
| `oct lint` | Lint em terminais separados por projeto |
| `oct test` | Testes em terminais separados por projeto |
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

## 🔧 Sobre o Projeto

### Princípios
- **Simplicidade**: Um comando (`oct init`) configura tudo
- **Cross-platform**: funciona no macOS, Windows e Linux  
- **Inteligente**: detecta yarn/npm automaticamente
- **Integrado**: gera workspace e tasks do VS Code
- **Reutilizável**: facilmente adaptável para outros projetos

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