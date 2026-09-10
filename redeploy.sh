#!/bin/bash
# ============================================================
# redeploy.sh — Atualização e redeploy do Organizar
# Executar no servidor: bash redeploy.sh
# ============================================================
set -e

COMPOSE_FILE="docker-compose.yml"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "============================================"
echo "  🔄 Organizar — Redeploy"
echo "============================================"
echo ""

cd "$APP_DIR"

# 1. Pull do código mais recente
echo "📥 Atualizando código do repositório..."
git pull origin main

# 2. Verifica se .env existe
if [ ! -f ".env" ]; then
  echo "⚠️  ATENÇÃO: arquivo .env não encontrado!"
  echo "   Copie .env.example para .env e preencha as variáveis."
  echo "   cp .env.example .env"
  exit 1
fi

# 3. Para os containers atuais
echo ""
echo "🛑 Parando containers..."
docker compose -f "$COMPOSE_FILE" down

# 4. Rebuilda as imagens
echo ""
echo "🏗️  Buildando imagens (isso pode demorar alguns minutos)..."
docker compose -f "$COMPOSE_FILE" build --no-cache

# 5. Sobe os containers
echo ""
echo "🚀 Subindo containers..."
docker compose -f "$COMPOSE_FILE" up -d

# 6. Aguarda o backend inicializar
echo ""
echo "⏳ Aguardando backend inicializar..."
sleep 10

# 7. Aplica as migrations SQL (se o MySQL aceitar)
echo ""
echo "🗄️  Aplicando migrations do banco de dados..."
docker compose exec backend python -c "
from app.database import engine, Base
import app.models
Base.metadata.create_all(bind=engine)
print('✅ Tabelas verificadas/criadas com sucesso.')
" 2>/dev/null || echo "   (Ignore se for a primeira vez; o FastAPI cria as tabelas no startup)"

# 8. Status final
echo ""
echo "============================================"
echo "  ✅ Redeploy concluído!"
echo "============================================"
echo ""
docker compose -f "$COMPOSE_FILE" ps
echo ""
echo "📋 Logs em tempo real: docker compose logs -f"
echo "🌐 Acesse: https://organize.davinunes.eti.br"
echo ""
