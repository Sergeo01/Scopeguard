$key = "$HOME\.ssh\deploy_key"
$hostip = "root@76.13.255.164"

Write-Host "Creating deployment archive..."
Push-Location "d:\Hackathon\NEAR\web"
tar -czf "..\deploy.tar.gz" app components context lib public
Pop-Location

Write-Host "Transferring archive to VPS via scp..."
scp -i $key -o StrictHostKeyChecking=no "d:\Hackathon\NEAR\deploy.tar.gz" "${hostip}:/var/www/scopeguard/web/deploy.tar.gz"
if (Test-Path "d:\Hackathon\NEAR\deploy.tar.gz") {
    Remove-Item "d:\Hackathon\NEAR\deploy.tar.gz" -Force
}

Write-Host "Extracting, building, and reloading PM2 on VPS..."
ssh -i $key -o StrictHostKeyChecking=no $hostip "cd /var/www/scopeguard/web && tar -xzf deploy.tar.gz && rm deploy.tar.gz && npm run build && pm2 reload scopeguard"

Write-Host "Deployment completed successfully!"
