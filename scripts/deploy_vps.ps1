$key = "$HOME\.ssh\deploy_key"
$hostip = "root@76.13.255.164"

Write-Host "Updating AuthModal.tsx on VPS..."
Get-Content -Raw "d:\Hackathon\NEAR\web\components\AuthModal.tsx" | ssh -i $key -o StrictHostKeyChecking=no $hostip "cat > /var/www/scopeguard/web/components/AuthModal.tsx"

Write-Host "Building and reloading Next.js..."
ssh -i $key -o StrictHostKeyChecking=no $hostip "cd /var/www/scopeguard/web && npm run build && pm2 reload scopeguard"

Write-Host "Done!"
