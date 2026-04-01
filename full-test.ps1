$headers = @{
    "Content-Type" = "application/json"
}

$registerBody = @{
    username = "testadmin"
    email = "testadmin@example.com"
    password = "admin123"
    business_name = "Mi Restaurante Test"
} | ConvertTo-Json

Write-Host "1. Registrando usuario..." -ForegroundColor Yellow
try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
    $token = $registerResponse.token
    $userCode = $registerResponse.user.code
    Write-Host "✅ Usuario registrado!" -ForegroundColor Green
    Write-Host "   Código de tienda: $userCode" -ForegroundColor Cyan
    Write-Host "   Token: $($token.Substring(0, [Math]::Min(50, $token.Length)))..." -ForegroundColor Cyan
    
    Write-Host "`n2. Creando categoría..." -ForegroundColor Yellow
    $categoryBody = @{
        name = "Bebidas"
        description = "Bebidas y refrescos"
    } | ConvertTo-Json
    
    $categoryHeaders = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $token"
    }
    
    $categoryResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/categories" -Method Post -Headers $categoryHeaders -ContentType "application/json" -Body $categoryBody
    Write-Host "✅ Categoría creada!" -ForegroundColor Green
    Write-Host "   ID: $($categoryResponse.id)" -ForegroundColor Cyan
    Write-Host "   Nombre: $($categoryResponse.name)" -ForegroundColor Cyan
    Write-Host "   Descripción: $($categoryResponse.description)" -ForegroundColor Cyan
    
    Write-Host "`n3. Verificando categorías..." -ForegroundColor Yellow
    $categoriesResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/categories" -Method Get -Headers $categoryHeaders -ContentType "application/json"
    Write-Host "✅ Categorías obtenidas: $($categoriesResponse.Count)" -ForegroundColor Green
    $categoriesResponse | ForEach-Object { Write-Host "   - $($_.name)" -ForegroundColor White }
    
    Write-Host "`n4. Verificando tienda pública..." -ForegroundColor Yellow
    $storeResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/public/$userCode" -Method Get -ContentType "application/json"
    Write-Host "✅ Tienda encontrada!" -ForegroundColor Green
    Write-Host "   Negocio: $($storeResponse.user.business_name)" -ForegroundColor Cyan
    Write-Host "   Productos: $($storeResponse.products.Count)" -ForegroundColor Cyan
    
    Write-Host "`n🎉 ¡Todas las pruebas pasaron exitosamente!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error:" $_.Exception.Message -ForegroundColor Red
    Write-Host "Response:" $_.Exception.Response -ForegroundColor Red
}
