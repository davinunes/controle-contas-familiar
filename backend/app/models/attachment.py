from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class AttachmentType(str, enum.Enum):
    boleto      = "boleto"
    danfe       = "danfe"
    comprovante = "comprovante"


class Attachment(Base):
    __tablename__ = "attachments"

    id                = Column(Integer, primary_key=True, index=True)
    occurrence_id     = Column(Integer, ForeignKey("expense_occurrences.id", ondelete="CASCADE"), nullable=False, index=True)
    type              = Column(Enum("boleto", "danfe", "comprovante"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    s3_key            = Column(String(500), nullable=False)
    s3_url            = Column(Text, nullable=True)
    file_size         = Column(Integer, nullable=True)
    mime_type         = Column(String(100), nullable=True)
    uploaded_at       = Column(DateTime, server_default=func.now())

    occurrence = relationship("Occurrence", back_populates="attachments")
