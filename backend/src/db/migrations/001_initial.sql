CREATE TABLE IF NOT EXISTS otp_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone           VARCHAR(20) NOT NULL,
    purpose         VARCHAR(50) NOT NULL DEFAULT 'login',
    challenge_id    UUID NOT NULL,
    device_id       VARCHAR(255) NOT NULL,
    otp_hash        TEXT NOT NULL,
    ip_address      INET NOT NULL,
    channel         VARCHAR(10) NOT NULL CHECK (channel IN ('web', 'mobile')),
    risk_score      SMALLINT NOT NULL DEFAULT 0,
    attempts        SMALLINT NOT NULL DEFAULT 0,
    max_attempts    SMALLINT NOT NULL DEFAULT 5,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'verified', 'expired', 'exhausted')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    verified_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose ON otp_requests(phone, purpose, status);
CREATE INDEX IF NOT EXISTS idx_otp_device ON otp_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_otp_created ON otp_requests(created_at);

CREATE TABLE IF NOT EXISTS sessions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone             VARCHAR(20) NOT NULL,
    device_id         VARCHAR(255) NOT NULL,
    access_token_jti  UUID NOT NULL UNIQUE,
    refresh_token_jti UUID NOT NULL UNIQUE,
    ip_address        INET NOT NULL,
    channel           VARCHAR(10) NOT NULL,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ NOT NULL,
    last_refreshed    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_phone_device ON sessions(phone, device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS devices (
    id                VARCHAR(255) PRIMARY KEY,
    phone             VARCHAR(20),
    channel           VARCHAR(10) NOT NULL,
    attestation_hash  TEXT,
    first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata          JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGSERIAL PRIMARY KEY,
    event_type      VARCHAR(50) NOT NULL,
    phone           VARCHAR(20),
    device_id       VARCHAR(255),
    ip_address      INET,
    risk_score      SMALLINT,
    success         BOOLEAN NOT NULL,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_phone ON audit_log(phone, created_at);
