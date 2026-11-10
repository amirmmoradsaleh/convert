-- AlterTable
ALTER TABLE "tool_contents" ADD COLUMN "customRelatedTools" JSONB;

-- CreateTable
CREATE TABLE "tool_revisions" (
    "id" TEXT NOT NULL,
    "toolContentId" TEXT NOT NULL,
    "toolSlug" TEXT NOT NULL,
    "contentSnapshot" JSONB NOT NULL,
    "seoSnapshot" JSONB,
    "authorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_revisions_toolSlug_idx" ON "tool_revisions"("toolSlug");

-- AddForeignKey
ALTER TABLE "tool_revisions" ADD CONSTRAINT "tool_revisions_toolContentId_fkey" FOREIGN KEY ("toolContentId") REFERENCES "tool_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_revisions" ADD CONSTRAINT "tool_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
