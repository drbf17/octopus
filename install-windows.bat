@echo off
echo 🐙 Octopus - Instalacao para Windows
echo.

echo [1/4] Instalando dependencias...
call yarn install
if errorlevel 1 (
    echo ❌ Erro ao instalar dependencias
    pause
    exit /b 1
)

echo.
echo [2/4] Fazendo link global...
call yarn link
if errorlevel 1 (
    echo ❌ Erro ao fazer yarn link
    pause
    exit /b 1
)

echo.
echo [3/4] Verificando PATH do Yarn...
where yarn >nul 2>&1
if errorlevel 1 (
    echo ❌ Yarn nao encontrado no PATH
    echo Por favor, adicione o Yarn ao PATH do sistema
    pause
    exit /b 1
)

echo.
echo [4/4] Testando comando oct...
call oct --help >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Comando 'oct' nao encontrado!
    echo.
    echo 💡 Solucoes:
    echo    1. Reinicie o PowerShell/CMD
    echo    2. Adicione ao PATH: %%LOCALAPPDATA%%\Yarn\bin
    echo    3. Use: npx oct [comando]
    echo.
) else (
    echo ✅ Comando 'oct' funcionando!
    echo.
    echo 🚀 Instalacao concluida com sucesso!
    echo    Execute: oct init
    echo.
)

pause