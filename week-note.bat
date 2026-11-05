@echo off
cd /d "%~dp0"
if exist "%~dp0Week Note.exe" (
  start "" "%~dp0Week Note.exe"
) else (
  start "" "%~dp0.venv\Scripts\pythonw.exe" "%~dp0app.py"
)
