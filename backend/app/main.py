from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import engine
from app.models import Tenant, User, UserTenant, RefreshToken, Expense, Occurrence, Attachment
from app.database import Base
from app.scheduler import start_scheduler, stop_scheduler
from app.routers import auth, tenants, users, expenses, occurrences, attachments, dashboard

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
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
app.include_router(auth.router,        prefix="/api")
app.include_router(tenants.router,     prefix="/api")
app.include_router(users.router,       prefix="/api")
app.include_router(expenses.router,    prefix="/api")
app.include_router(occurrences.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")
app.include_router(dashboard.router,   prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}
