from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserMe"


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Tenant (resumido para embed) ────────────────────────────
class TenantBrief(BaseModel):
    id:   int
    name: str
    slug: str

    model_config = {"from_attributes": True}


class UserTenantRole(BaseModel):
    tenant: TenantBrief
    role:   str

    model_config = {"from_attributes": True}


# ── Usuário autenticado ──────────────────────────────────────
class UserMe(BaseModel):
    id:           int
    name:         str
    email:        str
    is_superadmin: bool
    tenants:      list[UserTenantRole] = []

    model_config = {"from_attributes": True}


# ── Tenant CRUD ──────────────────────────────────────────────
class TenantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z0-9\-]+$")


class TenantUpdate(BaseModel):
    name:          Optional[str] = None
    s3_endpoint:   Optional[str] = None
    s3_bucket:     Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    s3_prefix:     Optional[str] = None


class TenantOut(BaseModel):
    id:            int
    name:          str
    slug:          str
    s3_endpoint:   Optional[str]
    s3_bucket:     Optional[str]
    s3_prefix:     Optional[str]
    # Nunca expor as chaves S3 no response
    created_at:    datetime
    updated_at:    datetime

    model_config = {"from_attributes": True}


# ── User CRUD ────────────────────────────────────────────────
class UserCreate(BaseModel):
    name:         str = Field(..., min_length=2, max_length=100)
    email:        EmailStr
    password:     str = Field(..., min_length=6)
    is_superadmin: bool = False
    active:       bool = True
    tenant_roles: list[dict] = []  # [{tenant_id: int, role: "admin"|"user"}]


class UserUpdate(BaseModel):
    name:         Optional[str] = None
    email:        Optional[EmailStr] = None
    password:     Optional[str] = None
    is_superadmin: Optional[bool] = None
    active:       Optional[bool] = None
    tenant_roles: Optional[list[dict]] = None


class UserOut(BaseModel):
    id:            int
    name:          str
    email:         str
    is_superadmin: bool
    active:        bool
    created_at:    datetime
    tenants:       list[UserTenantRole] = []

    model_config = {"from_attributes": True}
