Write-Host "Testing GET request to API..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/public/TEST" -Method Get
    Write-Host "Response:"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error:" $_.Exception.Message -ForegroundColor Red
}
