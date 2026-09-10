from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, Literal

from app.database import get_db
from app.models.cost_center import CostCenter
from app.models.user import User, UserTenant
from app.routers.auth import get_current_user
from app.schemas.cost_center import CostCenterCreate, CostCenterUpdate, CostCenterOut

router = APIRouter(prefix="/cost-centers", tags=["cost-centers"])


def _check_tenant_access(db: Session, user: User, tenant_id: int, require_admin: bool = False):
    if user.is_superadmin:
        return
    link = db.query(UserTenant).filter(
        UserTenant.user_id == user.id,
        UserTenant.tenant_id == tenant_id,
    ).first()
    if not link:
        raise HTTPException(status_code=403, detail="Sem acesso a este tenant")
    if require_admin and link.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores do tenant")


@router.get("", response_model=list[CostCenterOut])
def list_cost_centers(
    tenant_id: int = Query(...),
    type: Optional[Literal["person", "category"]] = Query(None),
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_tenant_access(db, current_user, tenant_id)
    q = db.query(CostCenter).filter(CostCenter.tenant_id == tenant_id)
    if type:
        q = q.filter(CostCenter.type == type)
    if active_only:
        q = q.filter(CostCenter.active == True)
    return q.order_by(CostCenter.name).all()


@router.post("", response_model=CostCenterOut, status_code=status.HTTP_201_CREATED)
def create_cost_center(
    payload: CostCenterCreate,
    tenant_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_tenant_access(db, current_user, tenant_id, require_admin=True)
    cc = CostCenter(
        tenant_id=tenant_id,
        name=payload.name,
        type=payload.type,
        color=payload.color or "#6C63FF",
        active=payload.active,
    )
    db.add(cc)
    db.commit()
    db.refresh(cc)
    return cc


@router.patch("/{cost_center_id}", response_model=CostCenterOut)
def update_cost_center(
    cost_center_id: int,
    payload: CostCenterUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cc = db.query(CostCenter).filter(CostCenter.id == cost_center_id).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Centro de custo não encontrado")
    _check_tenant_access(db, current_user, cc.tenant_id, require_admin=True)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cc, field, value)

    db.commit()
    db.refresh(cc)
    return cc


@router.delete("/{cost_center_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cost_center(
    cost_center_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cc = db.query(CostCenter).filter(CostCenter.id == cost_center_id).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Centro de custo não encontrado")
    _check_tenant_access(db, current_user, cc.tenant_id, require_admin=True)

    db.delete(cc)
    db.commit()
