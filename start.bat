@echo off
title BHD SmartFlow Backend
color 0A

echo Menjalankan BHD SmartFlow...
cd /d "%~dp0"

:: Cek apakah paket pg ada
if not exist "node_modules\pg" (
    echo Menginstal pendukung database...
    call npm install pg dotenv
)

echo Menghubungkan ke database...
call node api/index.js
pause
