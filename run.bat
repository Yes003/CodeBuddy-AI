@echo off
title CodeBuddy AI - Server
cls
echo ============================================================
echo   CodeBuddy AI - Your Personal AI Coding Mentor
echo ============================================================
echo.
echo Starting application server...
echo Access the app in your browser at: http://127.0.0.1:5000 (or http://127.0.0.1:5050)
echo.
".venv\Scripts\python.exe" app.py
pause
