# Octopus - Instalação para Windows PowerShell
Write-Host "🐙 Octopus - Instalação para Windows PowerShell" -ForegroundColor Blue
Write-Host ""

# 1. Instalar dependências
Write-Host "[1/5] Instalando dependências..." -ForegroundColor Cyan
try {
    yarn install
    Write-Host "✅ Dependências instaladas" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao instalar dependências" -ForegroundColor Red
    exit 1
}

# 2. Fazer yarn link
Write-Host "[2/5] Fazendo link global..." -ForegroundColor Cyan
try {
    yarn link
    Write-Host "✅ Yarn link realizado" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao fazer yarn link" -ForegroundColor Red
    exit 1
}

# 3. Verificar se yarn está no PATH
Write-Host "[3/5] Verificando PATH do Yarn..." -ForegroundColor Cyan
$yarnPath = Get-Command yarn -ErrorAction SilentlyContinue
if (-not $yarnPath) {
    Write-Host "❌ Yarn não encontrado no PATH" -ForegroundColor Red
    exit 1
}

# 4. Verificar diretório bin do Yarn
Write-Host "[4/5] Verificando diretório bin do Yarn..." -ForegroundColor Cyan
$yarnBinPath = "$env:LOCALAPPDATA\Yarn\bin"
if (-not (Test-Path $yarnBinPath)) {
    Write-Host "⚠️  Diretório $yarnBinPath não encontrado" -ForegroundColor Yellow
    $yarnBinPath = "$env:APPDATA\npm"
}

# Verificar se está no PATH
$currentPath = $env:PATH
$userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')

if ($currentPath -notlike "*$yarnBinPath*") {
    Write-Host "⚠️  Adicionando $yarnBinPath ao PATH do usuário..." -ForegroundColor Yellow
    
    # Adicionar temporariamente para a sessão atual
    $env:PATH += ";$yarnBinPath"
    
    # Adicionar permanentemente ao PATH do usuário (sem precisar de admin)
    if ($userPath -notlike "*$yarnBinPath*") {
        $newUserPath = if ($userPath) { "$userPath;$yarnBinPath" } else { $yarnBinPath }
        [Environment]::SetEnvironmentVariable('PATH', $newUserPath, 'User')
        Write-Host "✅ PATH do usuário atualizado permanentemente" -ForegroundColor Green
    }
}

# 5. Testar comando oct
Write-Host "[5/5] Testando comando oct..." -ForegroundColor Cyan
try {
    $octHelp = oct --help 2>&1
    Write-Host "✅ Comando 'oct' funcionando!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Instalação concluída com sucesso!" -ForegroundColor Green
    Write-Host "   Execute: oct init" -ForegroundColor White
} catch {
    Write-Host "⚠️  Comando 'oct' não encontrado!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Soluções:" -ForegroundColor Cyan
    Write-Host "   1. Reinicie o PowerShell (recomendado)" -ForegroundColor White
    Write-Host "   2. Use: npx oct [comando]" -ForegroundColor White
    Write-Host ""
    Write-Host "ℹ️  O PATH foi atualizado automaticamente." -ForegroundColor Cyan
    Write-Host "   Após reiniciar o PowerShell, o comando 'oct' deve funcionar." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Pressione qualquer tecla para continuar..."
Read-Host