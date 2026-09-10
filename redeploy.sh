#!/bin/bash
# ============================================================
# redeploy.sh — Atualização e redeploy do Organizar
#
# Uso:
#   bash redeploy.sh fast       # Modo rápido: aproveita cache do Docker e reconstrói só o que mudou
#   bash redeploy.sh backend    # Rápido: apenas o backend (leva ~5-10s)
#   bash redeploy.sh frontend   # Rápido: apenas o frontend
#   bash redeploy.sh full       # Completo: down + build --no-cache + up
#   bash redeploy.sh            # Padrão: modo fast inteligente
# ============================================================
set -e

COMPOSE_FILE="docker-compose.yml"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-fast}"

echo ""
echo "============================================"
echo "  🔄 Organizar — Redeploy (Modo: ${MODE^^})"
echo "============================================"
echo ""

cd "$APP_DIR"

# 1. Verifica se .env existe
if [ ! -f ".env" ]; then
  echo "⚠️  ATENÇÃO: arquivo .env não encontrado!"
  echo "   Copie .env.example para .env e preencha as variáveis."
  exit 1
fi

# Guarda commit atual para detectar o que mudou
PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")

# 2. Pull do código mais recente
echo "📥 Atualizando código do repositório..."
git pull origin main

NEW_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")

# Identifica arquivos modificados se houve pull
if [ -n "$PREV_COMMIT" ] && [ "$PREV_COMMIT" != "$NEW_COMMIT" ]; then
  CHANGED_FILES=$(git diff --name-only "$PREV_COMMIT" "$NEW_COMMIT")
  echo "📄 Arquivos alterados no último pull:"
  echo "$CHANGED_FILES" | sed 's/^/   - /'
  echo ""
else
  CHANGED_FILES=""
fi

# ============================================================
# EXECUÇÃO CONFORME O MODO
# ============================================================

case "$MODE" in
  backend)
    echo "⚡ Rebuilding apenas Backend (com cache)..."
    docker compose -f "$COMPOSE_FILE" up -d --build backend
    ;;

  frontend)
    echo "⚡ Rebuilding apenas Frontend (com cache)..."
    docker compose -f "$COMPOSE_FILE" up -d --build frontend
    ;;

  full|--full)
    echo "🛑 Parando containers..."
    docker compose -f "$COMPOSE_FILE" down
    echo "🏗️  Buildando tudo do zero (--no-cache)..."
    docker compose -f "$COMPOSE_FILE" build --no-cache
    echo "🚀 Subindo containers..."
    docker compose -f "$COMPOSE_FILE" up -d
    ;;

  fast|--fast|*)
    # Modo Fast Inteligente:
    # Se detectou que só mexeu no backend, só builda o backend!
    # Se só mexeu no frontend, só builda o frontend!
    # Se mexeu em ambos ou não soube determinar, builda ambos com cache.
    HAS_BACKEND=false
    HAS_FRONTEND=false
    HAS_CADDY=false

    if [ -n "$CHANGED_FILES" ]; then
      echo "$CHANGED_FILES" | grep -q "^backend/" && HAS_BACKEND=true || true
      echo "$CHANGED_FILES" | grep -q "^frontend/" && HAS_FRONTEND=true || true
      echo "$CHANGED_FILES" | grep -q "^caddy/" && HAS_CADDY=true || true
    fi

    if [ "$HAS_BACKEND" = true ] && [ "$HAS_FRONTEND" = false ]; then
      echo "🎯 Detectadas alterações apenas no Backend."
      echo "⚡ Rebuilding rápido do Backend (com cache)..."
      docker compose -f "$COMPOSE_FILE" up -d --build backend
    elif [ "$HAS_FRONTEND" = true ] && [ "$HAS_BACKEND" = false ]; then
      echo "🎯 Detectadas alterações apenas no Frontend."
      echo "⚡ Rebuilding rápido do Frontend (com cache)..."
      docker compose -f "$COMPOSE_FILE" up -d --build frontend
    elif [ "$HAS_CADDY" = true ] && [ "$HAS_BACKEND" = false ] && [ "$HAS_FRONTEND" = false ]; then
      echo "🎯 Detectada alteração apenas no Caddy."
      docker compose -f "$COMPOSE_FILE" restart caddy
    else
      echo "⚡ Rebuilding serviços necessários (com cache, sem derrubar o Caddy)..."
      docker compose -f "$COMPOSE_FILE" up -d --build
    fi
    ;;
esac

# Status final
echo ""
echo "============================================"
echo "  ✅ Redeploy concluído!"
echo "============================================"
echo ""
docker compose -f "$COMPOSE_FILE" ps
echo ""
echo "📋 Dicas de logs:"
echo "   docker compose logs -f backend"
echo "   docker compose logs -f frontend"
echo "🌐 Acesse: https://organize.davinunes.eti.br"
echo ""
