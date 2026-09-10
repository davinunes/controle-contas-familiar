from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.routers.auth import get_current_user, require_superadmin
from app.schemas.auth import TenantCreate, TenantUpdate, TenantOut
from app.services import s3_service

router = APIRouter(prefix="/tenants", tags=["tenants"])


def _check_tenant_admin(db: Session, user: User, tenant_id: int):
    if user.is_superadmin:
        return
    from app.models.user import UserTenant
    link = db.query(UserTenant).filter(
        UserTenant.user_id == user.id,
        UserTenant.tenant_id == tenant_id,
    ).first()
    if not link:
        raise HTTPException(status_code=403, detail="Sem acesso a este tenant")
    if link.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores deste tenant podem alterar suas configurações")


@router.get("", response_model=list[TenantOut])
def list_tenants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_superadmin:
        return db.query(Tenant).order_by(Tenant.name).all()
    from app.models.user import UserTenant
    tenant_ids = [
        link.tenant_id
        for link in db.query(UserTenant).filter(
            UserTenant.user_id == current_user.id,
            UserTenant.role == "admin",
        ).all()
    ]
    return db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).order_by(Tenant.name).all()


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    payload: TenantCreate,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    if db.query(Tenant).filter(Tenant.slug == payload.slug).first():
        raise HTTPException(status_code=400, detail="Slug já existe")
    tenant = Tenant(**payload.model_dump())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(
    tenant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_tenant_admin(db, current_user, tenant_id)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantOut)
def update_tenant(
    tenant_id: int,
    payload: TenantUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_tenant_admin(db, current_user, tenant_id)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(tenant, field, value)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(
    tenant_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    db.delete(tenant)
    db.commit()


@router.post("/{tenant_id}/test-s3")
def test_s3(
    tenant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_tenant_admin(db, current_user, tenant_id)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    return s3_service.test_connection(tenant)
