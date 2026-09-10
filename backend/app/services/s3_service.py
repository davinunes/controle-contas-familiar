import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from botocore.config import Config
from typing import BinaryIO
import httpx

from app.models.tenant import Tenant


def _get_par_base(storage_url: str) -> str:
    """Normaliza a URL Pré-autenticada da Oracle garantindo que termine em /o/."""
    url = storage_url.strip()
    if not url.endswith("/"):
        url += "/"
    if "/o/" not in url:
        url = url.rstrip("/") + "/o/"
    return url


def _get_s3_client(tenant: Tenant):
    """Cria cliente boto3 para S3 legado."""
    return boto3.client(
        "s3",
        endpoint_url=tenant.s3_endpoint,
        aws_access_key_id=tenant.s3_access_key,
        aws_secret_access_key=tenant.s3_secret_key,
        config=Config(signature_version="s3v4"),
    )


def _build_key(tenant: Tenant, folder: str, filename: str) -> str:
    prefix = (tenant.s3_prefix or "").strip("/")
    clean_folder = folder.strip("/")
    parts = [p for p in [prefix, clean_folder, filename] if p]
    return "/".join(parts)


def upload_file(
    tenant: Tenant,
    file_obj: BinaryIO,
    folder: str,
    filename: str,
    mime_type: str = "application/octet-stream",
) -> dict:
    """
    Faz upload de um arquivo para o Oracle Object Storage via URL Pré-autenticada (PAR) ou S3.
    Retorna: {s3_key, s3_url, file_size}
    """
    file_obj.seek(0, 2)
    file_size = file_obj.tell()
    file_obj.seek(0)
    file_bytes = file_obj.read()

    # 1. Modo Preferencial: URL Pré-autenticada (PAR) da Oracle
    if tenant.storage_url:
        par_base = _get_par_base(tenant.storage_url)
        clean_folder = folder.strip("/")
        key = f"{clean_folder}/{filename}" if clean_folder else filename
        dest_url = f"{par_base}{key}"

        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.put(
                    dest_url,
                    content=file_bytes,
                    headers={"Content-Type": mime_type},
                )
                if resp.status_code not in (200, 201, 204):
                    raise ValueError(
                        f"Erro Oracle PAR (HTTP {resp.status_code}): {resp.text[:200]}"
                    )
            return {"s3_key": key, "s3_url": dest_url, "file_size": file_size}
        except Exception as e:
            raise ValueError(f"Falha no upload via URL Pré-autenticada: {e}")

    # 2. Modo Legado: S3 com Access Key / Secret Key
    if not tenant.s3_bucket or not tenant.s3_access_key:
        raise ValueError("Storage não configurado para este tenant (configure a URL Pré-autenticada nas configurações).")

    import io
    client = _get_s3_client(tenant)
    key = _build_key(tenant, folder, filename)

    client.upload_fileobj(
        io.BytesIO(file_bytes),
        tenant.s3_bucket,
        key,
        ExtraArgs={"ContentType": mime_type, "ACL": "public-read"},
    )

    s3_url = f"{tenant.s3_endpoint.rstrip('/')}/{tenant.s3_bucket}/{key}"
    return {"s3_key": key, "s3_url": s3_url, "file_size": file_size}


def delete_file(tenant: Tenant, s3_key: str) -> bool:
    """Remove um arquivo do Storage."""
    if tenant.storage_url:
        par_base = _get_par_base(tenant.storage_url)
        dest_url = f"{par_base}{s3_key}"
        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.delete(dest_url)
                return resp.status_code in (200, 204, 404)
        except Exception:
            return False

    if tenant.s3_bucket and tenant.s3_access_key:
        try:
            client = _get_s3_client(tenant)
            client.delete_object(Bucket=tenant.s3_bucket, Key=s3_key)
            return True
        except (ClientError, NoCredentialsError):
            return False

    return False


def test_connection(tenant: Tenant) -> dict:
    """Testa a conexão de storage do tenant. Retorna {ok, message}."""
    if tenant.storage_url:
        par_base = _get_par_base(tenant.storage_url)
        test_key = ".test_organizar_ping.txt"
        test_url = f"{par_base}{test_key}"
        try:
            with httpx.Client(timeout=15.0) as client:
                # Testa escrita
                put_resp = client.put(test_url, content=b"ping", headers={"Content-Type": "text/plain"})
                if put_resp.status_code not in (200, 201, 204):
                    return {
                        "ok": False,
                        "message": f"Falha na permissão de escrita Oracle PAR (HTTP {put_resp.status_code}): {put_resp.text[:150]}",
                    }
                # Remove o arquivo de teste
                client.delete(test_url)
                return {"ok": True, "message": "URL Pré-autenticada testada com sucesso! Leitura e escrita funcionando."}
        except Exception as e:
            return {"ok": False, "message": f"Erro de conexão com URL Pré-autenticada: {e}"}

    if tenant.s3_bucket and tenant.s3_access_key:
        try:
            client = _get_s3_client(tenant)
            client.head_bucket(Bucket=tenant.s3_bucket)
            return {"ok": True, "message": "Conexão S3 bem-sucedida"}
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code == "403":
                return {"ok": True, "message": "Credenciais válidas (403 esperado no head)"}
            return {"ok": False, "message": str(e)}
        except Exception as e:
            return {"ok": False, "message": str(e)}

    return {"ok": False, "message": "Nenhum Storage configurado para este tenant."}
