import { Client as MinioClient } from "minio";
import type { Readable } from "node:stream";

export interface ObjectStorageOptions {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  useSSL: boolean;
}

export interface ObjectStoragePort {
  put(key: string, data: Buffer, mimeType: string | null): Promise<void>;
  get(key: string): Promise<Readable>;
}

export class MinioObjectStorage implements ObjectStoragePort {
  private readonly client: MinioClient;
  private readonly bucket: string;

  constructor(opts: ObjectStorageOptions) {
    const url = new URL(opts.endpoint);
    this.client = new MinioClient({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : 9000,
      useSSL: opts.useSSL,
      accessKey: opts.accessKey,
      secretKey: opts.secretKey,
    });
    this.bucket = opts.bucket;
  }

  async put(key: string, data: Buffer, mimeType: string | null): Promise<void> {
    await this.client.putObject(
      this.bucket,
      key,
      data,
      data.length,
      mimeType ? { "Content-Type": mimeType } : undefined,
    );
  }

  async get(key: string): Promise<Readable> {
    try {
      return await this.client.getObject(this.bucket, key);
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code: string }).code === "NoSuchKey") {
        throw new ObjectNotFoundError(key);
      }
      throw err;
    }
  }
}

export class ObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Object not found in storage: ${key}`);
    this.name = "ObjectNotFoundError";
  }
}
