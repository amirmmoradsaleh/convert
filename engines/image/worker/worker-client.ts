import type { ImageWorkerRequest, ImageWorkerResponse, WorkerProgressStage } from './worker-types';
import { processImageJob } from './image.worker';

/**
 * Client interface to communicate with Image Web Worker.
 * Handles task execution, real progress tracking, and fallback execution.
 */
export class ImageWorkerClient {
  private worker: Worker | null = null;
  private workerFailed = false;
  private pendingTasks = new Map<
    string,
    {
      resolve: (value: ImageWorkerResponse) => void;
      reject: (reason?: unknown) => void;
      onProgress?: (stage: WorkerProgressStage, progress: number) => void;
    }
  >();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && typeof Worker !== 'undefined';
  }

  private initWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (!this.isSupported() || this.workerFailed) return null;

    try {
      this.worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<ImageWorkerResponse>) => {
        const response = event.data;
        if (!response || !response.id) return;

        const task = this.pendingTasks.get(response.id);
        if (!task) return;

        if (response.type === 'progress') {
          if (response.stage && typeof response.progress === 'number') {
            task.onProgress?.(response.stage, response.progress);
          }
        } else {
          this.pendingTasks.delete(response.id);
          task.resolve(response);
        }
      };

      this.worker.onerror = () => {
        // Fall back to main thread execution if worker runtime errors out
        this.workerFailed = true;
        this.terminate();
      };

      return this.worker;
    } catch {
      this.workerFailed = true;
      this.worker = null;
      return null;
    }
  }

  public async executeTask(
    request: ImageWorkerRequest,
    onProgress?: (stage: WorkerProgressStage, progress: number) => void
  ): Promise<ImageWorkerResponse> {
    const worker = this.initWorker();

    if (worker && !this.workerFailed) {
      return new Promise<ImageWorkerResponse>((resolve, reject) => {
        this.pendingTasks.set(request.id, {
          resolve,
          reject,
          onProgress,
        });

        try {
          worker.postMessage(request, [request.fileData]);
        } catch {
          // If postMessage with transferable fails, try fallback
          this.pendingTasks.delete(request.id);
          this.executeFallback(request, onProgress).then(resolve).catch(reject);
        }
      });
    }

    return this.executeFallback(request, onProgress);
  }

  private async executeFallback(
    request: ImageWorkerRequest,
    onProgress?: (stage: WorkerProgressStage, progress: number) => void
  ): Promise<ImageWorkerResponse> {
    return await processImageJob(request, (stage, percent) => {
      onProgress?.(stage, percent);
    });
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingTasks.clear();
  }
}

export const imageWorkerClient = new ImageWorkerClient();

