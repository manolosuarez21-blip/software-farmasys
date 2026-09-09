@echo off
title FARMAsys - Sistema de Gestión Farmacéutica
color 0A

echo ============================================================
echo   🚀 INICIANDO FARMASYS - APLICACION DE ESCRITORIO
echo ============================================================
echo.

if not exist node_modules (
    echo [!] Instalando dependencias necesarias...
    call npm install
    echo.
)

echo [✓] Iniciando FARMAsys...
call npx electron .
