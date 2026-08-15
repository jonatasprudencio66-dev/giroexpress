@echo off  
title GiroExpress  
start cmd /k "cd /d C:\Users\cesar\OneDrive\µrea de Trabalho\Projeto entregas\giroexpress\backend && py -m uvicorn server:app --reload --port 8002"  
start cmd /k "cd /d C:\Users\cesar\OneDrive\µrea de Trabalho\Projeto entregas\giroexpress\frontend && npm start" 
