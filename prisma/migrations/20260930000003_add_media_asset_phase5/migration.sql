-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "url" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "alt" TEXT,
    "title" TEXT,
    "caption" TEXT,
    "description" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_filename_key" ON "media_assets"("filename");

-- CreateIndex
CREATE INDEX "media_assets_mimeType_idx" ON "media_assets"("mimeType");

-- CreateIndex
CREATE INDEX "media_assets_createdAt_idx" ON "media_assets"("createdAt");

-- CreateIndex
CREATE INDEX "media_assets_uploadedById_idx" ON "media_assets"("uploadedById");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
