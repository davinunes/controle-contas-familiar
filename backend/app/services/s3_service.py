import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from botocore.config import Config
from typing import Optional, BinaryIO
from app.models.tenant import Tenant


def _get_s3_client(tenant: Tenant):
    """Cria cliente boto3 com as credenciais S3 do tenant."""
    return boto3.client(
        "s3",
        endpoint_url=tenant.s3_endpoint,
        aws_access_key_id=tenant.s3_access_key,
        aws_secret_access_key=tenant.s3_secret_key,
        config=Config(signature_version="s3v4"),
    )


def _build_key(tenant: Tenant, folder: str, filename: str) -> str:
    prefix = (tenant.s3_prefix or "").strip("/")
    if prefix:
        return f"{prefix}/{folder}/{filename}"
    return f"{folder}/{filename}"


def upload_file(
    tenant: Tenant,
    file_obj: BinaryIO,
    folder: str,
    filename: str,
    mime_type: str = "application/octet-stream",
) -> dict:
    """
    Faz upload de um arquivo para o Oracle Object Storage.
    Retorna: {s3_key, s3_url, file_size}
    """
    if not tenant.s3_bucket or not tenant.s3_access_key:
        raise ValueError("S3 não configurado para este tenant")

    client = _get_s3_client(tenant)
    key = _build_key(tenant, folder, filename)

    file_obj.seek(0, 2)
    file_size = file_obj.tell()
    file_obj.seek(0)

    client.upload_fileobj(
        file_obj,
        tenant.s3_bucket,
        key,
        ExtraArgs={"ContentType": mime_type, "ACL": "public-read"},
    )

    # URL pública — Oracle Object Storage formato
    s3_url = f"{tenant.s3_endpoint.rstrip('/')}/{tenant.s3_bucket}/{key}"

    return {"s3_key": key, "s3_url": s3_url, "file_size": file_size}


def delete_file(tenant: Tenant, s3_key: str) -> bool:
    """Remove um arquivo do S3."""
    try:
        client = _get_s3_client(tenant)
        client.delete_object(Bucket=tenant.s3_bucket, Key=s3_key)
        return True
    except (ClientError, NoCredentialsError):
        return False


def test_connection(tenant: Tenant) -> dict:
    """Testa a conexão S3 do tenant. Retorna {ok, message}."""
    try:
        client = _get_s3_client(tenant)
        client.head_bucket(Bucket=tenant.s3_bucket)
        return {"ok": True, "message": "Conexão bem-sucedida"}
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "403":
            # Bucket existe mas sem permissão de head — credenciais válidas
            return {"ok": True, "message": "Credenciais válidas (403 esperado no head)"}
        return {"ok": False, "message": str(e)}
    except Exception as e:
        return {"ok": False, "message": str(e)}
