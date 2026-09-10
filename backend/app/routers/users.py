from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

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


def _get_admin_tenant_ids(user: User, db: Session) -> list[int] | None:
    """Retorna IDs dos tenants onde o usuário tem papel 'admin', ou None se for superadmin."""
    if user.is_superadmin:
        return None
    links = db.query(UserTenant).filter(
        UserTenant.user_id == user.id,
        UserTenant.role == "admin",
    ).all()
    return [link.tenant_id for link in links]


@router.get("", response_model=list[UserOut])
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    admin_tenant_ids = _get_admin_tenant_ids(current_user, db)
    if admin_tenant_ids is None:
        # Superadmin vê todos os usuários
        users = db.query(User).order_by(User.name).all()
        return [_serialize_user(u, db) for u in users]

    if not admin_tenant_ids:
        raise HTTPException(status_code=403, detail="Apenas administradores podem gerenciar usuários")

    # Admin de tenant vê os usuários que possuem vínculo com os seus tenants
    user_ids = [
        link.user_id
        for link in db.query(UserTenant).filter(UserTenant.tenant_id.in_(admin_tenant_ids)).all()
    ]
    if current_user.id not in user_ids:
        user_ids.append(current_user.id)

    users = db.query(User).filter(User.id.in_(user_ids)).order_by(User.name).all()
    return [_serialize_user(u, db) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    admin_tenant_ids = _get_admin_tenant_ids(current_user, db)
    if admin_tenant_ids is not None:
        if not admin_tenant_ids:
            raise HTTPException(status_code=403, detail="Apenas administradores podem criar usuários")
        if payload.is_superadmin:
            raise HTTPException(status_code=403, detail="Você não pode criar superadministradores")
        # Valida se todos os tenants atribuídos pertencem aos tenants gerenciados pelo admin
        for tr in payload.tenant_roles:
            t_id = tr.get("tenant_id")
            if t_id not in admin_tenant_ids:
                raise HTTPException(status_code=403, detail=f"Você não tem permissão para delegar o tenant {t_id}")

    # Verifica se email já existe
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        if admin_tenant_ids is not None:
            # Vincula aos tenants delegados
            for tr in payload.tenant_roles:
                t_id = tr["tenant_id"]
                link = db.query(UserTenant).filter(UserTenant.user_id == existing_user.id, UserTenant.tenant_id == t_id).first()
                if not link:
                    link = UserTenant(user_id=existing_user.id, tenant_id=t_id, role=tr.get("role", "user"))
                    db.add(link)
                else:
                    link.role = tr.get("role", "user")
            db.commit()
            db.refresh(existing_user)
            return _serialize_user(existing_user, db)
        else:
            raise HTTPException(status_code=400, detail="Email já cadastrado")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_superadmin=payload.is_superadmin if admin_tenant_ids is None else False,
        active=payload.active,
    )
    db.add(user)
    db.flush()

    for tr in payload.tenant_roles:
        t_id = tr["tenant_id"]
        if admin_tenant_ids is None or t_id in admin_tenant_ids:
            link = UserTenant(user_id=user.id, tenant_id=t_id, role=tr.get("role", "user"))
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    admin_tenant_ids = _get_admin_tenant_ids(current_user, db)
    if admin_tenant_ids is not None:
        has_common = db.query(UserTenant).filter(
            UserTenant.user_id == user.id,
            UserTenant.tenant_id.in_(admin_tenant_ids)
        ).first() is not None
        if not has_common and user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Sem acesso a este usuário")

    return _serialize_user(user, db)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    admin_tenant_ids = _get_admin_tenant_ids(current_user, db)
    if admin_tenant_ids is not None:
        if not admin_tenant_ids:
            raise HTTPException(status_code=403, detail="Apenas administradores podem editar usuários")
        if user.is_superadmin:
            raise HTTPException(status_code=403, detail="Você não pode editar um superadministrador")
        if payload.is_superadmin:
            raise HTTPException(status_code=403, detail="Você não pode promover a superadministrador")

        has_common = db.query(UserTenant).filter(
            UserTenant.user_id == user.id,
            UserTenant.tenant_id.in_(admin_tenant_ids)
        ).first() is not None
        if not has_common and user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Usuário não pertence a nenhum dos seus tenants")

    if payload.name is not None:       user.name = payload.name
    if payload.email is not None:      user.email = payload.email
    if payload.password is not None and len(payload.password.strip()) >= 6:
        user.password_hash = hash_password(payload.password.strip())
    if payload.active is not None:     user.active = payload.active

    if admin_tenant_ids is None and payload.is_superadmin is not None:
        user.is_superadmin = payload.is_superadmin

    if payload.tenant_roles is not None:
        if admin_tenant_ids is None:
            db.query(UserTenant).filter(UserTenant.user_id == user.id).delete()
            for tr in payload.tenant_roles:
                link = UserTenant(user_id=user.id, tenant_id=tr["tenant_id"], role=tr.get("role", "user"))
                db.add(link)
        else:
            db.query(UserTenant).filter(
                UserTenant.user_id == user.id,
                UserTenant.tenant_id.in_(admin_tenant_ids)
            ).delete(synchronize_session=False)

            for tr in payload.tenant_roles:
                t_id = tr.get("tenant_id")
                if t_id in admin_tenant_ids:
                    link = UserTenant(user_id=user.id, tenant_id=t_id, role=tr.get("role", "user"))
                    db.add(link)

    db.commit()
    db.refresh(user)
    return _serialize_user(user, db)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    admin_tenant_ids = _get_admin_tenant_ids(current_user, db)
    if admin_tenant_ids is None:
        db.delete(user)
        db.commit()
        return

    if user.is_superadmin:
        raise HTTPException(status_code=403, detail="Você não pode excluir um superadministrador")

    db.query(UserTenant).filter(
        UserTenant.user_id == user_id,
        UserTenant.tenant_id.in_(admin_tenant_ids)
    ).delete(synchronize_session=False)

    remaining = db.query(UserTenant).filter(UserTenant.user_id == user_id).count()
    if remaining == 0:
        db.delete(user)

    db.commit()
