from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserTenant
from app.routers.auth import get_current_user, require_superadmin
from app.schemas.auth import UserCreate, UserUpdate, UserOut, UserTenantRole, TenantBrief
from app.services.auth_service import hash_password

router = APIRouter(prefix="/users", tags=["users"])


def _serialize_user(user: User, db: Session) -> UserOut:
    links = db.query(UserTenant).filter(UserTenant.user_id == user.id).all()
    tenants = [
        UserTenantRole(
            tenant=TenantBrief.model_validate(link.tenant),
            role=link.role,
        )
        for link in links
    ]
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        is_superadmin=user.is_superadmin,
        active=user.active,
        created_at=user.created_at,
        tenants=tenants,
    )


@router.get("", response_model=list[UserOut])
def list_users(
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.name).all()
    return [_serialize_user(u, db) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_superadmin=payload.is_superadmin,
        active=payload.active,
    )
    db.add(user)
    db.flush()

    for tr in payload.tenant_roles:
        link = UserTenant(user_id=user.id, tenant_id=tr["tenant_id"], role=tr.get("role", "user"))
        db.add(link)

    db.commit()
    db.refresh(user)
    return _serialize_user(user, db)


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _serialize_user(current_user, db)


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_password = payload.get("password", "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Senha muito curta")
    current_user.password_hash = hash_password(new_password)
    db.commit()


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return _serialize_user(user, db)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if payload.name is not None:       user.name = payload.name
    if payload.email is not None:      user.email = payload.email
    if payload.password is not None:   user.password_hash = hash_password(payload.password)
    if payload.is_superadmin is not None: user.is_superadmin = payload.is_superadmin
    if payload.active is not None:     user.active = payload.active

    if payload.tenant_roles is not None:
        db.query(UserTenant).filter(UserTenant.user_id == user.id).delete()
        for tr in payload.tenant_roles:
            link = UserTenant(user_id=user.id, tenant_id=tr["tenant_id"], role=tr.get("role", "user"))
            db.add(link)

    db.commit()
    db.refresh(user)
    return _serialize_user(user, db)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.delete(user)
    db.commit()
