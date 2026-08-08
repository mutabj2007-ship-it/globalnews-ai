-- CreateTable
CREATE TABLE "ArticleCountry" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "relevanceScore" INTEGER NOT NULL,
    "isRelevant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleCountry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleCountry_countryCode_idx" ON "ArticleCountry"("countryCode");

-- CreateIndex
CREATE INDEX "ArticleCountry_relevanceScore_idx" ON "ArticleCountry"("relevanceScore");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCountry_articleId_countryCode_key" ON "ArticleCountry"("articleId", "countryCode");

-- AddForeignKey
ALTER TABLE "ArticleCountry" ADD CONSTRAINT "ArticleCountry_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
