# Auto-Send Cron for Scheduled Messages
# This script runs in the background and sends scheduled messages every minute
# Works even when browser is closed!

Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   ⏰ AUTO-SEND CRON STARTED!" -ForegroundColor White -BackgroundColor Green
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will check for scheduled messages every 60 seconds" -ForegroundColor Yellow
Write-Host "and send them automatically - even if browser is closed!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$checkCount = 0

while ($true) {
    $checkCount++
    $time = Get-Date -Format "HH:mm:ss"
    
    Write-Host "[$time] Check #$checkCount - Looking for scheduled messages..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/cron/send-scheduled" -Method Get -ErrorAction Stop
        
        if ($response.dispatched -gt 0) {
            Write-Host "[$time] ✅ SENT $($response.dispatched) MESSAGE(S)!" -ForegroundColor Green
            Write-Host "[$time]    Details:" -ForegroundColor White
            
            foreach ($result in $response.results) {
                if ($result.status -eq 'sent') {
                    Write-Host "[$time]    ✅ $($result.title): $($result.sent) sent, $($result.failed) failed" -ForegroundColor Green
                } elseif ($result.status -eq 'partially_sent') {
                    Write-Host "[$time]    ⚠️  $($result.title): $($result.sent) sent, $($result.failed) failed" -ForegroundColor Yellow
                } else {
                    Write-Host "[$time]    ❌ $($result.title): Failed" -ForegroundColor Red
                }
            }
            
            Write-Host ""
            Write-Host "[$time] 🎉 Messages delivered to Facebook Messenger!" -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host "[$time] No messages due yet (next check in 60s)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "[$time] ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "[$time]    Make sure dev server is running on http://localhost:3000" -ForegroundColor Yellow
    }
    
    # Wait 60 seconds before next check
    Start-Sleep -Seconds 60
}



