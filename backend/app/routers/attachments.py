from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
import io
import uuid
import os

from app.database import get_db
from app.models.attachment import Attachment
from app.models.occurrence import Occurrence
from app.models.tenant import Tenant
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.expense import AttachmentBrief
from app.services import s3_service

router = APIRouter(prefix="/attachments", tags=["attachments"])

ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
MAX_SIZE_MB = 10


@router.post("/occurrences/{occurrence_id}", response_model=AttachmentBrief)
async def upload_attachment(
    occurrence_id: int,
    attachment_type: str = Query(..., pattern="^(boleto|danfe|comprovante)$"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    occ = db.query(Occurrence).filter(Occurrence.id == occurrence_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")

    tenant = db.query(Tenant).filter(Tenant.id == occ.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    if not tenant.storage_url and not tenant.s3_bucket:
        raise HTTPException(status_code=400, detail="Storage não configurado para este tenant (configure a URL pré-autenticada nas configurações)")

    # Validação do tipo de arquivo
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de arquivo não suportado: {content_type}. Use PDF, JPEG ou PNG."
        )

    # Lê o conteúdo
    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Arquivo muito grande (máx {MAX_SIZE_MB}MB)")

    # Gera nome único para o S3
    ext = os.path.splitext(file.filename or "file")[1] or ".pdf"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    folder = f"occurrences/{occurrence_id}/{attachment_type}"

    # Upload
    file_obj = io.BytesIO(content)
    result = s3_service.upload_file(
        tenant=tenant,
        file_obj=file_obj,
        folder=folder,
        filename=unique_name,
        mime_type=content_type,
    )

    # Remove anterior do mesmo tipo (um por tipo por ocorrência)
    existing = db.query(Attachment).filter(
        Attachment.occurrence_id == occurrence_id,
        Attachment.type == attachment_type,
    ).first()
    if existing:
        s3_service.delete_file(tenant, existing.s3_key)
        db.delete(existing)

    # Salva no banco
    att = Attachment(
        occurrence_id=occurrence_id,
        type=attachment_type,
        original_filename=file.filename or unique_name,
        s3_key=result["s3_key"],
        s3_url=result["s3_url"],
        file_size=result["file_size"],
        mime_type=content_type,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.delete("/{attachment_id}")
def delete_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")

    occ = db.query(Occurrence).filter(Occurrence.id == att.occurrence_id).first()
    tenant = db.query(Tenant).filter(Tenant.id == occ.tenant_id).first()

    if tenant:
        s3_service.delete_file(tenant, att.s3_key)

    db.delete(att)
    db.commit()
    return {"ok": True}
