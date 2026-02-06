export interface StorageProvider {
  upload(
    file: File | Buffer,
    fileName: string,
    options?: { contentType?: string; disposition?: string }
  ): Promise<string>;
  delete(fileName: string): Promise<void>;
  exists(params: { key: string }): Promise<boolean>;
  getPublicUrl(params: { key: string }): string;
}

export class StorageManager {
  private providers: Map<string, StorageProvider> = new Map();

  addProvider(name: string, provider: StorageProvider) {
    this.providers.set(name, provider);
  }

  getProvider(name: string): StorageProvider | undefined {
    return this.providers.get(name);
  }

  async exists(params: { key: string }): Promise<boolean> {
    const provider = this.getProvider('default'); // assuming default
    return provider?.exists(params) || false;
  }

  getPublicUrl(params: { key: string }): string {
    const provider = this.getProvider('default');
    return provider?.getPublicUrl(params) || '';
  }

  async uploadFile(params: {
    file?: File | Buffer;
    body?: any;
    fileName?: string;
    key: string;
    contentType?: string;
    disposition?: string;
  }): Promise<{
    success: boolean;
    url?: string;
    key?: string;
    error?: string;
  }> {
    const provider = this.getProvider('default');
    if (!provider) return { success: false, error: 'No storage provider' };
    try {
      const url = await provider.upload(
        params.file || params.body,
        params.fileName || params.key,
        {
          contentType: params.contentType,
          disposition: params.disposition,
        }
      );
      return { success: true, url, key: params.key };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

let storageService: StorageManager | null = null;

export async function getStorageService(): Promise<StorageManager> {
  if (!storageService) {
    storageService = new StorageManager();
    // TODO: Add actual providers here
  }
  return storageService;
}
