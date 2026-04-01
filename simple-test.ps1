$body = @{
    username = "testuser"
    email = "test@example.com"
    password = "test123"
    business_name = "Test Restaurant"
} | ConvertTo-Json

Write-Host "Testing registration..."
$response = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/register" -Method Post -ContentType "application/json" -Body $body
Write-Host "Response:"
$response | ConvertTo-Json -Depth 10
