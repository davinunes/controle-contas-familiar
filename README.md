# 💰 Organizar — Controle de Contas Familiar

App multitenant para gerenciar despesas de terceiros (sogros, mãe, etc.), com lançamentos avulsos e recorrentes, upload de artefatos na Oracle Object Storage, leitor de QR Code nativo e relatório para WhatsApp.

---

## Stack

| Componente | Tecnologia |
|---|---|
| Backend | FastAPI (Python 3.11) + APScheduler |
| Frontend | Next.js 14 (PWA, dark mode) |
| Banco | MySQL (Oracle Free Tier) |
| Storage | Oracle Object Storage (S3-compat.) |
| Proxy/SSL | Caddy (HTTPS automático via Let's Encrypt) |
| Deploy | Docker Compose + Portainer |

---

## Pré-requisitos no servidor

- Ubuntu 22.04+
- Docker + Docker Compose v2
- Git
- Porta 80 e 443 abertas na Oracle VPC (Security List)
- Domínios `organize.davinunes.eti.br` e `organize.digitalinovation.com.br` apontando para o IP da VPS

---

## Deploy — Primeiro uso

### 1. Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/controle-contas-familiar.git
cd controle-contas-familiar
```

### 2. Crie o arquivo `.env`

```bash
cp .env.example .env
nano .env
```

Preencha as variáveis:

```env
DB_HOST=10.0.0.208
DB_PORT=3306
DB_NAME=azakdb
DB_USER=SEU_USUARIO_MYSQL
DB_PASSWORD=SUA_SENHA_MYSQL

# Gere uma chave JWT forte:
# python3 -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=CHAVE_FORTE_AQUI
```

### 3. Suba os containers

```bash
docker compose up -d --build
```

### 4. Verifique os logs

```bash
docker compose logs -f
```

Aguarde o Caddy obter os certificados SSL (pode levar 1-2 minutos na primeira vez).

### 5. Acesse o app

```
https://organize.davinunes.eti.br
```

**Credenciais iniciais do admin:**
- Email: `admin@organize.local`
- Senha: `Admin@123`

> ⚠️ **Troque a senha após o primeiro login!** Acesse Config → Minha Conta.

---

## Redeploy (atualizar código)

Execute no servidor:

```bash
bash redeploy.sh
```

Ou manualmente:

```bash
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Configuração inicial no app

### 1. Criar Tenants

Acesse **Config → Tenants** e crie os grupos:
- Ex: "Sogros" (slug: `sogros`)
- Ex: "Minha Mãe" (slug: `mae`)

### 2. Configurar S3 por Tenant

Em **Config → Tenants**, clique em "🔧 S3" no tenant desejado e preencha:

| Campo | Valor |
|---|---|
| Endpoint | `https://NAMESPACE.compat.objectstorage.sa-saopaulo-1.oraclecloud.com` |
| Bucket | Nome do bucket criado na Oracle |
| Access Key | Customer Secret Key (Oracle IAM) |
| Secret Key | Secret da Customer Secret Key |
| Prefix | Ex: `organizar/sogros` |

Use **🧪 Testar** para validar a conexão.

### 3. Criar usuários

Em **Config → Usuários**, crie usuários para sua esposa ou outros colaboradores e vincule ao tenant correto.

---

## Funcionalidades

### Tela de Resumo
- Filtro por mês com navegação ◀ ▶
- Seção de **contas vencidas de meses anteriores** (em vermelho)
- Seção das contas do mês atual
- Botão **"📋 Copiar para WhatsApp"** — gera texto formatado
- Botão **✅ Pagar** rápido em cada item

### Nova Despesa
- **Avulsa**: conta que não se repete
- **Parcelada**: N×valor fixo, data da 1ª parcela
- **Recorrente**: vence todo dia X do mês; suporta campo "Detalhes Importantes" (código concessionária, UC, site do boleto, etc.)

### Ocorrência Mensal
Cada despesa gera uma ocorrência por mês com:
- **Valor editável** (clique no valor para editar)
- **Upload de artefatos**: Boleto, DANFE, Comprovante (PDF ou imagem)
- **Painel da NF**: URL da nota fiscal + botões "Abrir" e "Copiar"
- Status: Pendente / Pago

#### Fluxo para obter a DANFE
1. No mercado: use o **📷 Scanner QR** para capturar a URL da NF
2. Em casa/escritório: na tela da ocorrência, clique **"🌐 Abrir NF no navegador"**
3. Passe pela verificação anti-robô e baixe o PDF
4. Volte no app e faça upload do PDF como **DANFE**

### Dashboard Fiado
- Total pendente acumulado (todos os meses)
- Total reembolsado
- Gráfico de barras dos últimos 6 meses (Pendente vs Pago)

---

## Geração automática de ocorrências

O APScheduler roda automaticamente todo **dia 1º de cada mês às 00:05** e gera as ocorrências do mês para:
- Despesas **recorrentes** (valor = R$ 0,00, a ser preenchido)
- Despesas **parceladas** em andamento (valor já preenchido)

Para gerar manualmente (admin):

```
POST /api/dashboard/generate-occurrences?year=2025&month=10
```

---

## Estrutura de containers

```
caddy:443/80  → (proxy)
  /api/*      → backend:8000  (FastAPI)
  /*          → frontend:3000 (Next.js)
```

O banco MySQL é **externo** (Oracle Free Tier) — não está no compose.

---

## Logs e monitoramento

```bash
# Logs de todos os serviços
docker compose logs -f

# Logs do Caddy (SSL + acesso)
docker compose logs caddy

# Status dos containers
docker compose ps

# Uso de recursos
docker stats
```

---

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `DB_HOST` | IP do MySQL | `localhost` |
| `DB_PORT` | Porta MySQL | `3306` |
| `DB_NAME` | Nome do banco | `azakdb` |
| `DB_USER` | Usuário MySQL | — |
| `DB_PASSWORD` | Senha MySQL | — |
| `JWT_SECRET` | Chave secreta JWT | — |
| `JWT_EXPIRE_MINUTES` | Validade do token | `1440` |
| `JWT_REFRESH_EXPIRE_DAYS` | Validade do refresh | `30` |
| `ALLOWED_ORIGINS` | CORS (separado por vírgula) | `*` |

---

## Troubleshooting

### Caddy não consegue certificado SSL
- Verifique se as portas 80 e 443 estão abertas na **Security List da Oracle VPC**
- Verifique se o domínio aponta corretamente para o IP da VPS: `dig organize.davinunes.eti.br`
- Veja os logs: `docker compose logs caddy`

### Backend não conecta ao MySQL
- Verifique se o IP `10.0.0.208` está acessível a partir do container: `docker compose exec backend ping 10.0.0.208`
- Confirme usuário/senha no `.env`
- Verifique as regras de firewall do MySQL Oracle (Security List do subnet privado)

### Upload S3 falha
- Confirme que o bucket existe e que as credenciais têm permissão de `OBJECT_WRITE`
- Use o botão **🧪 Testar** na tela de Config para diagnosticar
- O Endpoint deve ser no formato: `https://NAMESPACE.compat.objectstorage.REGIAO.oraclecloud.com`

### Regenerar token JWT manualmente
Gere uma nova chave e atualize o `.env`:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## Segurança

- As senhas são armazenadas com **bcrypt** (fator 12)
- JWT com expiração de 24h + refresh token de 30 dias
- Refresh tokens são descartados após uso (rotação)
- As chaves S3 nunca são expostas via API (apenas escrita)
- CORS configurado para aceitar apenas os domínios cadastrados em produção

---

## Licença

Uso pessoal / familiar.
