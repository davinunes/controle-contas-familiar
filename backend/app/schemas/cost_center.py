from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal


class CostCenterCreate(BaseModel):
    name:   str = Field(..., min_length=1, max_length=100)
    type:   Literal["person", "category"] = "category"
    color:  Optional[str] = "#6C63FF"
    active: bool = True


class CostCenterUpdate(BaseModel):
    name:   Optional[str] = None
    type:   Optional[Literal["person", "category"]] = None
    color:  Optional[str] = None
    active: Optional[bool] = None


class CostCenterBrief(BaseModel):
    id:    int
    name:  str
    type:  str
    color: Optional[str] = None

    model_config = {"from_attributes": True}


class CostCenterOut(BaseModel):
    id:         int
    tenant_id:  int
    name:       str
    type:       str
    color:      Optional[str] = None
    active:     bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
