$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    username = "admin"
    email = "admin@example.com"
    password = "admin123"
    business_name = "Mi Restaurante"
} | ConvertTo-Json

try {
    Write-Host "Intentando registrar usuario..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/register" -Headers $headers -Body $body -ContentType "application/json"
    Write-Host "Respuesta:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error:" $_.Exception.Message -ForegroundColor Red
}
