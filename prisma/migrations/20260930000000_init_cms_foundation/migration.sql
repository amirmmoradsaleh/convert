-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_contents" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "customCss" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_seo" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
    "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "twitterTitle" TEXT,
    "twitterDescription" TEXT,
    "twitterImage" TEXT,
    "schemaType" TEXT,
    "schemaJson" JSONB,
    "focusKeyword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_seo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_contents" (
    "id" TEXT NOT NULL,
    "toolSlug" TEXT NOT NULL,
    "customTitle" TEXT,
    "customH1" TEXT,
    "customDescription" TEXT,
    "customIntro" TEXT,
    "customValueProp" TEXT,
    "customHowTo" JSONB,
    "customFeatures" JSONB,
    "customFaq" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_seo" (
    "id" TEXT NOT NULL,
    "toolContentId" TEXT NOT NULL,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
    "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "schemaType" TEXT,
    "schemaJson" JSONB,
    "focusKeyword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_seo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_revisions" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentSnapshot" JSONB NOT NULL,
    "seoSnapshot" JSONB,
    "authorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "siteName" TEXT NOT NULL DEFAULT 'Free Online File Tools',
    "siteUrl" TEXT NOT NULL DEFAULT 'https://example.com',
    "defaultSeoTitle" TEXT,
    "defaultMetaDescription" TEXT,
    "defaultOgImage" TEXT,
    "defaultTwitterImage" TEXT,
    "googleAnalyticsId" TEXT,
    "googleAdSenseId" TEXT,
    "socialLinks" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "page_contents_pageId_key" ON "page_contents"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "page_seo_pageId_key" ON "page_seo"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "tool_contents_toolSlug_key" ON "tool_contents"("toolSlug");

-- CreateIndex
CREATE UNIQUE INDEX "tool_seo_toolContentId_key" ON "tool_seo"("toolContentId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "page_contents" ADD CONSTRAINT "page_contents_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_seo" ADD CONSTRAINT "page_seo_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_seo" ADD CONSTRAINT "tool_seo_toolContentId_fkey" FOREIGN KEY ("toolContentId") REFERENCES "tool_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
