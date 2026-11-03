CREATE TABLE "admin_members" (
  "user_id" UUID PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "role" TEXT NOT NULL CHECK ("role" IN ('owner', 'admin')),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "granted_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "admin_access_state" (
  "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
  "initialized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "admin_invitations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('owner', 'admin')),
  "token_hash" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL CHECK ("status" IN ('sending', 'pending', 'delivery_failed', 'accepted', 'revoked')),
  "invited_by" UUID NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "admin_invitations_email_idx" ON "admin_invitations"("email");
CREATE TABLE "admin_access_audit" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "details" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "admin_access_audit_actor_id_created_at_idx" ON "admin_access_audit"("actor_id", "created_at");

-- Browser clients must never mutate access tables directly. Only the backend's
-- privileged database connection manages these records.
ALTER TABLE "admin_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_access_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_access_audit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "admin_members", "admin_access_state", "admin_invitations", "admin_access_audit" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "admin_members", "admin_access_state", "admin_invitations", "admin_access_audit" FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "admin_members", "admin_access_state", "admin_invitations", "admin_access_audit" FROM authenticated;
  END IF;
END $$;