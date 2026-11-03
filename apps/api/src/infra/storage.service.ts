import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';

import { type Env, InjectEnv } from '../config/env';

type Bucket = 'private' | 'public';

/**
 * MinIO/S3. Private bucket — faqat presigned URL orqali; public bucket —
 * PUBLIC_ASSET_ORIGIN/<bucket>/<key> doimiy manzil (Caddy proksi qiladi).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  /** Presigned URL brauzer yetadigan manzil bilan imzolanishi kerak. */
  private readonly signer: S3Client;
  private readonly buckets: Record<Bucket, string>;

  constructor(@InjectEnv() private readonly env: Env) {
    const base = {
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    };
    this.client = new S3Client({ ...base, endpoint: env.S3_ENDPOINT });
    this.signer = env.S3_PUBLIC_ENDPOINT
      ? new S3Client({ ...base, endpoint: env.S3_PUBLIC_ENDPOINT })
      : this.client;
    this.buckets = { private: env.S3_BUCKET_PRIVATE, public: env.S3_BUCKET_PUBLIC };

    if (env.NODE_ENV === 'production' && /localhost|CHANGE_ME/.test(env.PUBLIC_ASSET_ORIGIN)) {
      this.logger.error(`PUBLIC_ASSET_ORIGIN prod'da noto'g'ri: "${env.PUBLIC_ASSET_ORIGIN}"`);
    }
  }

  async put(key: string, body: Buffer, contentType: string, bucket: Bucket = 'private') {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.buckets[bucket],
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /** O'chirish best-effort: fayl yo'qligi asosiy amalni to'xtatmasin. */
  async remove(key: string, bucket: Bucket = 'private') {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.buckets[bucket], Key: key }));
    } catch (err) {
      this.logger.warn(`S3 delete ${bucket}/${key}: ${(err as Error).message}`);
    }
  }

  publicUrl(key: string): string {
    return `${this.env.PUBLIC_ASSET_ORIGIN}/${this.buckets.public}/${key}`;
  }

  /** Bizning URL'dan (public yoki presigned) bucket va kalitni ajratadi. */
  locate(url: string): { bucket: Bucket; key: string } | null {
    for (const bucket of ['public', 'private'] as const) {
      const marker = `/${this.buckets[bucket]}/`;
      const i = url.indexOf(marker);
      if (i !== -1) {
        const key = decodeURIComponent(url.slice(i + marker.length).split('?')[0] ?? '');
        if (key) return { bucket, key };
      }
    }
    return null;
  }

  async downloadUrl(key: string, fileName: string, ttlSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.buckets.private,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
      }),
      { expiresIn: ttlSeconds },
    );
  }
}
