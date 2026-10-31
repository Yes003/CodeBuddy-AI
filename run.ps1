Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  CodeBuddy AI — Your Personal AI Coding Mentor" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan
Write-Host "Starting server..." -ForegroundColor Green
Write-Host "Open your browser at: http://127.0.0.1:5000`n" -ForegroundColor Yellow

& ".\.venv\Scripts\python.exe" app.py
