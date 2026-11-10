import fs from 'fs';
import path from 'path';

export interface StorageResult {
  storagePath: string;
  url: string;
}

export interface StorageProvider {
  saveFile(buffer: Buffer | Uint8Array, filename: string, mimeType: string): Promise<StorageResult>;
  deleteFile(storagePath: string): Promise<void>;
  getFileUrl(filename: string): string;
}

/**
 * Local Filesystem Storage Provider.
 * Stores files in public/uploads/ and serves them via /uploads/<filename>.
 * Designed with a clean interface so future migrations to S3, GCS, or R2
 * only require replacing this provider without touching any CMS business logic.
 */
export class LocalStorageProvider implements StorageProvider {
  private uploadsDir: string;
  private publicPrefix: string;

  constructor(uploadsDir?: string, publicPrefix = '/uploads') {
    this.uploadsDir = uploadsDir || path.join(process.cwd(), 'public', 'uploads');
    this.publicPrefix = publicPrefix;
  }

  private ensureDirectoryExists() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async saveFile(buffer: Buffer | Uint8Array, filename: string, _mimeType: string): Promise<StorageResult> {
    this.ensureDirectoryExists();

    // Prevent any directory traversal in storage filename
    const cleanFilename = path.basename(filename);
    const destinationPath = path.join(this.uploadsDir, cleanFilename);

    await fs.promises.writeFile(destinationPath, Buffer.from(buffer));

    const publicUrl = `${this.publicPrefix}/${cleanFilename}`;
    return {
      storagePath: destinationPath,
      url: publicUrl,
    };
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      // Ensure target is within uploadsDir to prevent deleting files outside
      const resolved = path.resolve(storagePath);
      const resolvedUploads = path.resolve(this.uploadsDir);

      if (resolved.startsWith(resolvedUploads)) {
        if (fs.existsSync(resolved)) {
          await fs.promises.unlink(resolved);
        }
      }
    } catch (err) {
      console.warn('[LocalStorageProvider] Warning deleting file:', err);
    }
  }

  getFileUrl(filename: string): string {
    const cleanFilename = path.basename(filename);
    return `${this.publicPrefix}/${cleanFilename}`;
  }
}

let activeStorageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!activeStorageProvider) {
    activeStorageProvider = new LocalStorageProvider();
  }
  return activeStorageProvider;
}

export function setStorageProvider(provider: StorageProvider) {
  activeStorageProvider = provider;
}
