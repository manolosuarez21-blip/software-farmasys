@echo off
title FARMAsys - Servidor de Punto de Venta Local
color 0A

echo ============================================================
echo   🚀 INICIANDO FARMASYS - SISTEMA DE GESTION FARMACEUTICA
echo ============================================================
echo.

REM Verificar si existen los módulos instalados
if not exist node_modules (
    echo [!] Instalando dependencias necesarias por primera vez...
    call npm install
    echo.
)

echo [✓] Servidor activado. Abriendo FARMAsys en el navegador...
timeout /t 2 >nul
start http://localhost:3000

echo.
call npm start
pause
