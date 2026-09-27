-- MY INTELLIGENCE BACKEND + DATA R1 — Saved Stories and the stable visit boundary.
--
-- ADDITIVE ONLY. No UPDATE, no DELETE, no DROP, no type change, and no DEFAULT
-- on the new User column: every existing user keeps visitBoundaryAt NULL
-- ("make no return claim") and every existing Article row is untouched.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "visitBoundaryAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SavedStory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleRef" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "providerArticleId" TEXT,
    "title" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceDomain" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "publishedAtBasis" TEXT NOT NULL,
    "imageUrl" TEXT,
    "countryCodes" TEXT[],
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedStory_pkey" PRIMARY KEY ("id"),
    -- The identity is a sha256 hex digest, never a provider id or free text.
    CONSTRAINT "SavedStory_articleRef_sha256" CHECK ("articleRef" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "SavedStory_publishedAtBasis" CHECK ("publishedAtBasis" IN ('publisher', 'observed'))
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedStory_userId_articleRef_key" ON "SavedStory"("userId", "articleRef");

-- CreateIndex
CREATE INDEX "SavedStory_userId_savedAt_idx" ON "SavedStory"("userId", "savedAt");

-- AddForeignKey
ALTER TABLE "SavedStory" ADD CONSTRAINT "SavedStory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
