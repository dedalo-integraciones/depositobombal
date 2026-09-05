# Depósito Bombal — Catálogo online

## Uso local
npm install
cp .env.example .env   # completar claves de Firebase
npm run dev

## Subir a GitHub
git init
git add .
git commit -m "Scaffold inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/deposito-bombal.git
git push -u origin main

## Google AI Studio
Conectar este repo en AI Studio (Build) y usar el prompt:
"Leé GEMINI.md y docs/data-init.md. Ejecutá el PASO 1 del roadmap y esperá mi confirmación antes de continuar."