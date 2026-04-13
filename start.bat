@echo off
title BHD SmartFlow Backend
color 0A
echo.
echo  ╔══════════════════════════════════════╗
echo  ║    BHD SmartFlow - Starting...       ║
echo  ╚══════════════════════════════════════╝
echo.

:: Cek apakah node_modules sudah ada di folder api
IF NOT EXIST "%~dp0node_modules" (
  echo  [SETUP] Menginstall dependencies pertama kali...
  cd /d "%~dp0"
  call npm install
  echo  [OK] Dependencies berhasil diinstall!
  echo.
)

:: Tampilkan IP laptop untuk diakses dari HP
echo  ─────────────────────────────────────
echo  Alamat untuk dibuka di HP (WiFi sama):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4"') do (
  set ip=%%a
  set ip=!ip: =!
  echo  📱 http://%%a:3001/bhd-smartflow-v10.html
)
echo  ─────────────────────────────────────
echo.

:: Jalankan server
cd /d "%~dp0"
echo  [START] Server berjalan... Tekan Ctrl+C untuk stop.
echo.
node api/index.js
pause
