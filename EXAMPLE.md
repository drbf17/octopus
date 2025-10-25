# Exemplo: Usando Octopus em um Novo Projeto

Este exemplo mostra como configurar o Octopus para gerenciar um projeto e-commerce com múltiplos micro-serviços.

## 1. Estrutura do Projeto

```
ecommerce-project/
├── octopus/                    # Ferramenta Octopus (copiada)
├── frontend/                   # Repositório do frontend
├── api-gateway/               # Gateway de APIs  
├── user-service/              # Serviço de usuários
├── product-service/           # Serviço de produtos
├── order-service/             # Serviço de pedidos
└── .vscode/
    └── tasks.json            # Gerado automaticamente
```

## 2. Configuração do default-repos.json

```json
{
  "repositories": [
    {
      "name": "Frontend",
      "url": "https://github.com/minha-empresa/ecommerce-frontend.git",
      "localPath": "frontend",
      "active": true,
      "port": 3000,
      "priority": 1,
      "description": "Interface do usuário - React/Next.js"
    },
    {
      "name": "API Gateway", 
      "url": "https://github.com/minha-empresa/ecommerce-gateway.git",
      "localPath": "api-gateway",
      "active": true,
      "port": 8000,
      "priority": 2,
      "description": "Gateway de APIs - Node.js/Express"
    },
    {
      "name": "User Service",
      "url": "https://github.com/minha-empresa/user-service.git", 
      "localPath": "user-service",
      "active": true,
      "port": 8001,
      "priority": 3,
      "description": "Micro-serviço de usuários"
    },
    {
      "name": "Product Service",
      "url": "https://github.com/minha-empresa/product-service.git",
      "localPath": "product-service", 
      "active": true,
      "port": 8002,
      "priority": 3,
      "description": "Micro-serviço de produtos"
    },
    {
      "name": "Order Service",
      "url": "https://github.com/minha-empresa/order-service.git",
      "localPath": "order-service",
      "active": false,
      "port": 8003,
      "priority": 4,
      "description": "Micro-serviço de pedidos (opcional)"
    }
  ],
  "settings": {
    "defaultBranch": "develop",
    "autoInstall": true,
    "createVSCodeTasks": true,
    "terminalType": "system"
  }
}
```

## 3. Passos para Configurar

```bash
# 1. Copiar o Octopus
cp -r /path/to/octopus /meu-projeto-ecommerce/octopus
cd /meu-projeto-ecommerce/octopus
npm install

# 2. Editar configuração
# Edite octopus/config/default-repos.json com as URLs dos seus repos

# 3. Tornar comando disponível (opcional)
npm link

# 4. Configurar projeto
cd /meu-projeto-ecommerce
oct init

# 5. Clonar repositórios
oct clone

# 6. Iniciar desenvolvimento
oct checkout develop
oct start
```

## 4. Resultado Final

Após a configuração, você terá:

- ✅ 4 repositórios clonados e configurados
- ✅ Tasks do VS Code para iniciar todos os serviços
- ✅ Comandos para operações Git sincronizadas
- ✅ Monitoramento de status centralizado
- ✅ Compatibilidade total com Windows, macOS e Linux

## 5. Comandos Úteis no Dia a Dia

```bash
# Verificar status de todos os repos
oct status

# Atualizar todos para a branch develop  
oct checkout develop

# Criar nova branch para feature em todos os repos
oct new-branch feature/new-payment develop

# Instalar dependências em todos
oct install

# Iniciar todos os serviços de desenvolvimento
oct start

# Ver Tasks do VS Code
# Cmd+Shift+P > "Tasks: Run Task" > "Octopus - Start All"
```

## 6. Adaptação para Outros Projetos

Para usar este exemplo em outro contexto:

1. **Copie a pasta `octopus/`** para seu novo projeto
2. **Edite `config/default-repos.json`** com suas URLs
3. **Ajuste as portas** conforme necessário  
4. **Configure prioridades** (1=primeiro a iniciar)
5. **Execute `oct init`** no diretório raiz

O Octopus se adaptará automaticamente ao seu sistema operacional e estrutura de projeto!