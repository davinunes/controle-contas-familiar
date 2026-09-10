-- ============================================================
-- Controle de Contas Familiar — Schema MySQL
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- Tenants (grupos: sogros, mãe, etc.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(50)  NOT NULL UNIQUE,
    s3_endpoint   VARCHAR(255) NULL COMMENT 'Ex: https://xyz.compat.objectstorage.sa-saopaulo-1.oraclecloud.com',
    s3_bucket     VARCHAR(100) NULL,
    s3_access_key VARCHAR(255) NULL,
    s3_secret_key VARCHAR(255) NULL,
    s3_prefix     VARCHAR(100) NULL DEFAULT '' COMMENT 'Pasta dentro do bucket',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Usuários
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_superadmin TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Admin global — acessa config de todos os tenants',
    active        TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Vínculo usuário ↔ tenant (N:N com role por tenant)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_tenants (
    user_id   INT UNSIGNED NOT NULL,
    tenant_id INT UNSIGNED NOT NULL,
    role      ENUM('admin','user') NOT NULL DEFAULT 'user',
    PRIMARY KEY (user_id, tenant_id),
    CONSTRAINT fk_ut_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    CONSTRAINT fk_ut_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Despesas (templates)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id           INT UNSIGNED NOT NULL,
    title               VARCHAR(200) NOT NULL,
    description         TEXT         NULL,
    type                ENUM('single','installment','recurring') NOT NULL DEFAULT 'single',

    -- Parceladas
    total_installments  INT          NULL COMMENT 'Total de parcelas (tipo installment)',
    installment_value   DECIMAL(10,2) NULL COMMENT 'Valor fixo por parcela',
    first_due_date      DATE         NULL COMMENT 'Data de vencimento da 1ª parcela',

    -- Recorrentes e avulsas
    recurrence_day      INT          NULL COMMENT 'Dia do mês de vencimento (1-31)',

    -- Detalhes importantes (recorrentes: concessionária, UC, site, etc.)
    important_details   JSON         NULL COMMENT 'Array de {label, value}',

    active              TINYINT(1)   NOT NULL DEFAULT 1,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_exp_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_exp_tenant (tenant_id),
    INDEX idx_exp_type   (type),
    INDEX idx_exp_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Ocorrências mensais de cada despesa
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_occurrences (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    expense_id          INT UNSIGNED NOT NULL,
    tenant_id           INT UNSIGNED NOT NULL,
    reference_month     DATE         NOT NULL COMMENT 'YYYY-MM-01 — mês de referência',
    installment_number  INT          NULL COMMENT 'Número da parcela (tipo installment)',
    value               DECIMAL(10,2) NOT NULL,
    due_date            DATE         NOT NULL,
    nf_url              TEXT         NULL COMMENT 'URL da nota fiscal (via QR Code ou manual)',
    status              ENUM('pending','paid') NOT NULL DEFAULT 'pending',
    paid_at             DATETIME     NULL,
    notes               TEXT         NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_occ_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    CONSTRAINT fk_occ_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id)  ON DELETE CASCADE,
    UNIQUE KEY uq_occ_month (expense_id, reference_month, installment_number),
    INDEX idx_occ_tenant_month (tenant_id, reference_month),
    INDEX idx_occ_status       (status),
    INDEX idx_occ_due_date     (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Anexos por ocorrência
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    occurrence_id     INT UNSIGNED NOT NULL,
    type              ENUM('boleto','danfe','comprovante') NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    s3_key            VARCHAR(500) NOT NULL,
    s3_url            TEXT         NULL COMMENT 'URL de acesso ao arquivo no S3',
    file_size         INT UNSIGNED NULL COMMENT 'Tamanho em bytes',
    mime_type         VARCHAR(100) NULL,
    uploaded_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_att_occurrence FOREIGN KEY (occurrence_id) REFERENCES expense_occurrences(id) ON DELETE CASCADE,
    INDEX idx_att_occurrence (occurrence_id),
    INDEX idx_att_type       (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Refresh tokens (autenticação JWT)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME     NOT NULL,
    revoked    TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_rt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Dados iniciais — superadmin padrão
-- Senha: Admin@123 (trocar após primeiro login!)
-- Hash bcrypt gerado com: bcrypt.hash("Admin@123", 12)
-- ============================================================
INSERT IGNORE INTO users (name, email, password_hash, is_superadmin, active)
VALUES (
    'Administrador',
    'admin@organize.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PcEBrG',
    1,
    1
);
