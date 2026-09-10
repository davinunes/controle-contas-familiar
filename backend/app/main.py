from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import engine, SessionLocal
from app.models import Tenant, User, UserTenant, RefreshToken, Expense, Occurrence, Attachment
from app.database import Base
from app.scheduler import start_scheduler, stop_scheduler
from app.routers import auth, tenants, cost_centers, users, expenses, occurrences, attachments, dashboard

settings = get_settings()


def seed_admin():
    """Cria o superadmin padrão se não houver nenhum usuário no banco."""
    from app.models.user import User as UserModel
    from app.services.auth_service import hash_password
    db = SessionLocal()
    try:
        if db.query(UserModel).count() == 0:
            admin = UserModel(
                name="Administrador",
                email="admin@admin.com",
                password_hash=hash_password("Admin@123"),
                is_superadmin=True,
                active=True,
            )
            db.add(admin)
            db.commit()
            print("[Seed] Superadmin criado: admin@admin.com / Admin@123", flush=True)
        else:
            print("[Seed] Usuários já existem, seed ignorado.", flush=True)
    except Exception as e:
        print(f"[Seed] Erro: {e}", flush=True)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    # Garante a existência de novas colunas caso as tabelas já tenham sido criadas
    from sqlalchemy import text
    with engine.connect() as conn:
        for sql in [
            "ALTER TABLE tenants ADD COLUMN storage_url TEXT NULL",
            "ALTER TABLE expenses ADD COLUMN cost_center_id INT NULL",
            "ALTER TABLE expenses ADD COLUMN person_id INT NULL",
        ]:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Coluna já existe ou erro ignorado
    seed_admin()
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra routers
app.include_router(auth.router,         prefix="/api")
app.include_router(tenants.router,      prefix="/api")
app.include_router(cost_centers.router, prefix="/api")
app.include_router(users.router,        prefix="/api")
app.include_router(expenses.router,     prefix="/api")
app.include_router(occurrences.router,  prefix="/api")
app.include_router(attachments.router,  prefix="/api")
app.include_router(dashboard.router,    prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}
