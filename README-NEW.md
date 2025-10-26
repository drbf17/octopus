# 🐙 Octopus

Multi-repository manager for React Native micro apps with advanced multi-directory command execution

## ✨ Features

- 🔧 Initialize and configure multiple repositories
- 📦 Clone repositories from configuration
- 🌿 Create and checkout branches across all repos
- 📦 Install dependencies in parallel
- 🚀 **Multiple startup modes**: Terminal, Concurrently, PM2, Tmux
- 🎯 **Custom commands** across all repos (parallel or sequential)
- 📊 Check repository status
- 🖥️ VS Code integration (tasks and workspace)
- 🛠️ **Advanced process management** with PM2
- 📜 **Auto-generate startup scripts**

## 🚀 Installation

```bash
npm install -g ./
```

## 📘 Usage

### Basic Commands
```bash
# Initialize Octopus
oct init

# Clone repositories
oct clone

# Install dependencies
oct install
```

### 🎯 Advanced Startup Modes

```bash
# 1. Terminal mode (default) - separate terminals
oct start

# 2. Concurrently mode - parallel execution in one terminal
oct start --mode concurrently

# 3. PM2 mode - daemon processes with monitoring
oct start --mode pm2

# 4. Tmux mode - organized terminal sessions
oct start --mode tmux
```

### 🔧 Custom Commands

```bash
# Run command sequentially in all repos
oct run "yarn test"

# Run command in parallel
oct run "yarn build" --parallel

# Filter specific repositories
oct run "yarn lint" --filter "Auth"

# More examples
oct run "git status"
oct run "npm audit" --parallel
oct run "yarn upgrade-interactive"
```

### 🛠️ Process Management (PM2)

```bash
# Start all services as daemons
oct start --mode pm2

# Check PM2 status
oct pm2 list

# View logs
oct pm2 logs

# Monitor processes
oct pm2 monit

# Restart all
oct pm2 restart all

# Stop specific service
oct pm2 stop Auth

# Stop all services  
oct pm2 stop all
```

### 📜 Generate Scripts

```bash
# Create Concurrently startup script
oct script --mode concurrently

# Create Tmux startup script  
oct script --mode tmux

# Execute generated script
./start-all.sh
```

### 🌿 Git Operations

```bash
# Create new branch across all repos
oct new-branch feature/new-feature

# Checkout existing branch
oct checkout develop

# Check status
oct status

# List repositories
oct list
```

## 🎛️ Configuration

Configuration is stored in `config/octopus-config.json` after running `oct init`.

Example configuration:
```json
{
  "projectName": "my-microservices",
  "repositories": [
    {
      "name": "Auth",
      "url": "https://github.com/user/auth.git",
      "localPath": "Auth",
      "port": 8084,
      "active": true
    }
  ]
}
```

## 🖥️ VS Code Integration

Octopus creates:
- `.vscode/tasks.json` with individual and compound tasks
- Multi-folder workspace file for easy navigation
- ESLint working directories configuration

## 🛠️ Tools Integration

### Concurrently
Perfect for development - runs all services in parallel with colored output and process management.

### PM2
Production-grade process manager:
- Automatic restarts
- Log management
- Process monitoring
- Memory/CPU usage tracking

### Tmux
Terminal multiplexer for organized development:
- Multiple terminal sessions
- Easy navigation between services
- Persistent sessions

## 🔧 Prerequisites

- Node.js 14+
- Git
- Yarn or NPM

### Optional (for specific modes)
- **PM2 mode**: Auto-installed via npx
- **Tmux mode**: `brew install tmux` (macOS) or `apt install tmux` (Linux)

## 📋 Examples

### Development Workflow
```bash
# 1. Setup project
oct init
oct clone
oct install

# 2. Start development (choose your preferred mode)
oct start --mode concurrently    # For active development
oct start --mode tmux           # For organized terminal management
oct start --mode pm2            # For background daemon processes

# 3. Run operations across all repos
oct run "yarn test" --parallel
oct run "git status"
oct new-branch feature/payment-integration

# 4. Monitor with PM2 (if using PM2 mode)
oct pm2 logs
oct pm2 monit
```

### Microservices Management
```bash
# Quick health check across all services
oct run "curl -f http://localhost:\${PORT}/health || echo 'Service down'" --parallel

# Update dependencies across all repos
oct run "yarn upgrade" --parallel

# Lint and format all codebases
oct run "yarn lint --fix && yarn format" --parallel

# Build all for production
oct run "yarn build" --parallel
```

## 🆚 Mode Comparison

| Mode | Best For | Pros | Cons |
|------|----------|------|------|
| **Terminal** | Simple development | Native terminals, familiar | Multiple windows to manage |
| **Concurrently** | Active development | Single terminal, colored output | All processes in one terminal |
| **PM2** | Production/Background | Process monitoring, auto-restart | Requires PM2 knowledge |
| **Tmux** | Power users | Organized sessions, persistent | Learning curve |

## 🔄 Migration from Old Version

If you were using the old terminal-based approach:

```bash
# Old way
oct start  # Opens multiple terminals

# New enhanced ways
oct start --mode concurrently  # Single terminal, parallel
oct start --mode pm2          # Background daemons
oct start --mode tmux         # Organized sessions
```

## 🐛 Troubleshooting

### "Cannot access 'process' before initialization" 
✅ **Fixed!** - Updated variable naming to avoid conflicts with Node.js global `process`

### Command not found
```bash
# Make sure octopus is installed
npm list -g octopus

# Or install locally
cd octopus && npm install
./bin/oct --help
```

### Tmux not working
```bash
# Install tmux
brew install tmux        # macOS
apt install tmux         # Ubuntu/Debian
```

### PM2 commands failing
```bash
# PM2 is automatically installed via npx
# But you can install globally for better performance
npm install -g pm2
```