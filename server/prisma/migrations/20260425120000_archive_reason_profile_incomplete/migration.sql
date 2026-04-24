-- Add governance archive reason for assets published before profile setup completed.
-- Must be the only statement in this migration: PostgreSQL does not allow using a new
-- enum value in the same transaction as ALTER TYPE ... ADD VALUE (see PG error 55P04).
ALTER TYPE "ArchiveReason" ADD VALUE 'PROFILE_INCOMPLETE';
