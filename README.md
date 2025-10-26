# 🐙 Octopus - Multi-Repository Manager

Ferramenta CLI para gerenciar múltiplos repositórios de micro apps de forma eficiente e cross-platform.

## 🌍 Compatibilidade Cross-Platform

✅ **macOS** - Terminal.app com AppleScript  
✅ **Windows** - CMD nativo  
✅ **Linux** - gnome-terminal  

## 🚀 Instalação

```bash
# 1. Instalar dependências
cd octopus
yarn install

# 2. Tornar comando global (opcional)
yarn link
```

## 🎯 Uso Básico - Tudo em Um Comando

### `oct init` - Setup Completo Automático

```bash
oct init
```

**O que acontece:**
1. 📝 Pergunta o nome do projeto
2. 📋 Mostra lista de repositórios disponíveis
3. ✅ Seleção interativa (Space = selecionar, Enter = confirmar)
4. 📥 **Clone automático** dos repositórios selecionados
5. 📦 **Instalação automática** (yarn install em todos)
6. 🔧 **Criação de tasks VS Code** para desenvolvimento
7. 🗂️ **Geração de workspace VS Code** com todos os repositórios

**Resultado:** Projeto completo configurado e pronto para desenvolvimento!

## 📋 Comandos Adicionais

```bash
# Controle de Git
oct checkout <branch>           # Checkout + pull em todos
oct new-branch <name> [base]    # Nova branch em todos
oct status                      # Status de todos os repositórios

# Desenvolvimento Web  
oct clone                       # Clona repos em falta
oct install                     # yarn install em todos
oct start                       # Inicia todos em terminais separados

# Desenvolvimento Mobile (Host App)
oct android                     # Executa yarn android no Host
oct ios                         # Executa pod install + yarn ios no Host
```

## 🖥️ Integração VS Code

Após `oct init`, você terá:

### 🗂️ **Workspace Automático**
- Arquivo `{nome-projeto}-workspace.code-workspace`
- **Pasta Root** (onde ficam .vscode, tasks, etc.)
- **Pasta Octopus** (comandos CLI sempre acessíveis)  
- **Cada repositório** como pasta separada

**Para usar:** `File > Open Workspace from File`

### ⚡ **Tasks Integradas**
1. **Cmd+Shift+P** (macOS) ou **Ctrl+Shift+P** (Windows/Linux)
2. Digite **"Tasks: Run Task"**
3. Selecione **"Octopus - Start All"**

Cada repositório roda em seu próprio terminal! 🚀

## 📁 Estrutura Gerada

Após `oct init`, você terá:

```
seu-projeto/
├── .vscode/
│   └── tasks.json              # Tasks automáticas
├── projeto-workspace.code-workspace  # Workspace VS Code
├── octopus/                    # Ferramenta CLI
├── Host/                       # Repositório clonado
├── Auth/                       # Repositório clonado
└── Home/                       # Repositório clonado
```

## ⚙️ Personalização

### Usar em Outros Projetos

```bash
# 1. Copiar Octopus
cp -r octopus /novo-projeto/octopus
cd /novo-projeto/octopus && yarn install

# 2. Editar configuração
# Abra: octopus/config/default-repos.json
# Altere URLs, nomes e portas dos seus repositórios

# 3. Executar
cd /novo-projeto && oct init
```

### Exemplo de Configuração (`default-repos.json`)

```json
{
  "repositories": [
    {
      "name": "Frontend",
      "url": "https://github.com/user/frontend.git",
      "localPath": "frontend",
      "active": true,
      "port": 3000,
      "priority": 1,
      "description": "Interface do usuário"
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

### Configuração do Host (para Mobile)

Para usar `oct android` e `oct ios`, marque o repositório principal como Host:

```json
{
  "name": "Host",
  "url": "https://github.com/user/host-app.git", 
  "localPath": "host-app",
  "active": true,
  "port": 8081,
  "priority": 1,
  "isHost": true,                    // ✨ Campo especial para Host
  "description": "Host application"
}
```

## 🔄 Fluxo de Trabalho

### Primeira vez:
```bash
oct init     # Configura tudo automaticamente
# ✅ Repositórios clonados
# ✅ Dependências instaladas  
# ✅ Workspace VS Code criado
```

### Desenvolvimento diário:

**Web Development:**
```bash
oct checkout develop    # Atualiza todos para develop
oct start              # Inicia todos os servidores web
# Use workspace VS Code para navegar entre repos
```

**Mobile Development:**
```bash
oct checkout develop    # Atualiza todos para develop  
oct start              # Inicia servidores web (Metro bundlers)
oct android            # Executa no Android (Host app)
oct ios                # Executa no iOS (Host app)
```

### Nova feature:
```bash
oct new-branch feature/login develop  # Cria branch em todos
# ... desenvolver ...
oct install                          # Se houver novas dependências
```

## 🚨 Arquivos Importantes

### ✅ Versionados (templates):
- `config/default-repos.json` - Template de repositórios
- `src/octopus.js` - Código fonte
- `package.json` - Dependências

### 🚫 Ignorados (gerados automaticamente):
- `config/octopus-config.json` - Criado pelo `oct init`
- `.vscode/` - Tasks geradas
- `*-workspace.code-workspace` - Workspace gerado

## 🎯 Vantagens

✅ **Setup em um comando** - `oct init` faz tudo  
✅ **Cross-platform** - macOS, Windows, Linux  
✅ **Workspace VS Code** - Todos repos organizados  
✅ **Tasks automáticas** - Inicia todos com um clique  
✅ **Git sincronizado** - Operações em todos repos  
✅ **Reutilizável** - Use em qualquer projeto  

## 🐛 Solução de Problemas

### Terminal não abre (Windows)
```bash
# Verifique se cmd está no PATH
where cmd
```

### Terminal não abre (Linux)
```bash
# Instale gnome-terminal
sudo apt install gnome-terminal
```

### Tasks não aparecem no VS Code
- ✅ Abra o **workspace** (não pastas individuais)
- ✅ Verifique se existe `.vscode/tasks.json`
- ✅ Use `File > Open Workspace from File`

---

**🐙 Octopus - Gerencie seus repositórios com facilidade em qualquer plataforma!** ✨