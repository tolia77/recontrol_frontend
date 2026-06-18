/**
 * Committed deterministic audit credentials for the isolated audit DB.
 *
 * These are non-secret fixtures baked into the audit seed
 * (recontrol_backend/db/seeds/audit.rb). They grant access only to the
 * isolated local audit stack (recontrol_backend_audit) — never dev/prod.
 *
 * email:    audit-admin@recontrol.local
 * password: AuditAdmin123!
 * role:     admin
 */
export const AUDIT_EMAIL = "audit-admin@recontrol.local";
export const AUDIT_PASSWORD = "AuditAdmin123!";
