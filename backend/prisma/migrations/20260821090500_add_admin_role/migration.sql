-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ANALYST');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminRole" "AdminRole";

-- CreateIndex
CREATE INDEX "User_adminRole_idx" ON "User"("adminRole");
