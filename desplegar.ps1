# Script para desplegar a Netlify
Write-Host "=== DESPLEGANDO APLICACIÓN WEB ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que web-build existe
if (-not (Test-Path "web-build")) {
    Write-Host "ERROR: Carpeta web-build no encontrada" -ForegroundColor Red
    Write-Host "Ejecuta primero: npm run build:web" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Carpeta web-build encontrada" -ForegroundColor Green
Write-Host ""

# Desplegar
Write-Host "Desplegando a Netlify..." -ForegroundColor Yellow
netlify deploy --prod --dir=web-build --site=FutbolDelFuturo

Write-Host ""
Write-Host "=== DESPLIEGUE COMPLETADO ===" -ForegroundColor Green
Write-Host "Tu aplicación está disponible en: https://FutbolDelFuturo.netlify.app" -ForegroundColor Cyan

