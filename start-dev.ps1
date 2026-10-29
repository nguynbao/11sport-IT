# =============================================================================
# 11Sport - Script Khởi Chạy Nhanh Môi Trường Phát Triển (Local Dev)
# Khởi động đồng thời: server (4000), web POS & Kho (3000), cms Quản trị (3001)
# =============================================================================

$ErrorActionPreference = "Stop"
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "=== [11Sport DevOps] Kiem tra moi truong Node.js ===" -ForegroundColor Cyan
node -v
npm -v

Write-Host "=== [11Sport DevOps] Khoi dong MongoDB (Docker Port 27017) ===" -ForegroundColor Cyan
try {
    Set-Location $RootDir
    docker compose up -d mongodb
} catch {
    Write-Warning "Khong the khoi dong Docker MongoDB, server se tu dong dung bo nho fallback."
}

function Start-ServiceProcess {
    param (
        [string]$Name,
        [string]$Folder,
        [int]$Port,
        [string]$Command
    )

    $ServicePath = Join-Path $RootDir $Folder
    if (-not (Test-Path $ServicePath)) {
        Write-Warning "Thu muc $ServicePath chua ton tai. Bo qua $Name."
        return
    }

    Write-Host "-> Khoi dong $Name tai port $Port ($ServicePath)..." -ForegroundColor Green
    $psCommand = "`$env:PATH = 'C:\Program Files\nodejs;' + `$env:PATH; Set-Location '$ServicePath'; $Command"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $psCommand -WindowStyle Normal
}

# 1. Khoi dong Backend API Server (Port 4000)
Start-ServiceProcess -Name "11Sport Server API" -Folder "server" -Port 4000 -Command "npm run dev"

# 2. Khoi dong Web POS & Kho (Port 3000)
Start-ServiceProcess -Name "11Sport Web (POS & Kho)" -Folder "web" -Port 3000 -Command "npm run dev"

# 3. Khoi dong CMS Quan tri (Port 3001)
Start-ServiceProcess -Name "11Sport CMS (Quan tri)" -Folder "cms" -Port 3001 -Command "npm run dev"

Write-Host ""
Write-Host "=== Da gui lenh khoi dong toan bo he thong 11Sport ===" -ForegroundColor Yellow
Write-Host "- Server API : http://localhost:4000/api/v1"
Write-Host "- Web POS/Kho: http://localhost:3000"
Write-Host "- CMS Admin  : http://localhost:3001"
