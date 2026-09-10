from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserTenant
from app.models.tenant import Tenant
from app.services.auth_service import (
    authenticate_user, create_access_token, create_refresh_token,
    verify_refresh_token, decode_access_token, get_user_tenants,
)
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, UserMe, UserTenantRole, TenantBrief

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


def _build_user_me(user: User, db: Session) -> UserMe:
    if user.is_superadmin:
        all_tenants = db.query(Tenant).order_by(Tenant.name).all()
        tenants = [
            UserTenantRole(
                tenant=TenantBrief.model_validate(t),
                role="admin",
            )
            for t in all_tenants
        ]
    else:
        links = db.query(UserTenant).filter(UserTenant.user_id == user.id).all()
        tenants = [
            UserTenantRole(
                tenant=TenantBrief.model_validate(link.tenant),
                role=link.role,
            )
            for link in links
        ]
    return UserMe(
        id=user.id,
        name=user.name,
        email=user.email,
        is_superadmin=user.is_superadmin,
        tenants=tenants,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token não fornecido")
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token com identificador inválido")
    user = db.query(User).filter(User.id == user_id, User.active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    return user


def require_tenant_admin(
    tenant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if current_user.is_superadmin:
        return current_user
    link = db.query(UserTenant).filter(
        UserTenant.user_id == current_user.id,
        UserTenant.tenant_id == tenant_id,
        UserTenant.role == "admin",
    ).first()
    if not link:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    return current_user


def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas superadmin")
    return current_user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    access_token  = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token(db, user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_build_user_me(user, db),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    user = verify_refresh_token(db, payload.refresh_token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")

    access_token  = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token(db, user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_build_user_me(user, db),
    )


@router.get("/me", response_model=UserMe)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _build_user_me(current_user, db)
