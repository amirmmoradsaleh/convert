-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP(3);
