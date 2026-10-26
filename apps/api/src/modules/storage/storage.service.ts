import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Minimal S3-compatible (MinIO) storage service.
 * Uses env variables:
 *   • S3_ENDPOINT — Docker network ichidagi MinIO manzili (masalan
 *     `http://minio:9000`). Upload/delete uchun ishlatiladi.
 *   • S3_PUBLIC_ENDPOINT — brauzerdan yetib boradigan tashqi manzil
 *     (masalan `http://localhost:9000` yoki `https://s3.domain.uz`).
 *     Presigned download URL'lar shu manzil orqali generatsiya qilinadi.
 *     Agar berilmasa, S3_ENDPOINT'ga qaytadi (bu ishlab chiqarishda,
 *     ichki va tashqi manzil bir xil bo'lganda kifoya).
 *   • S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_PRIVATE.
 *   • PUBLIC_ASSET_ORIGIN — `ecobalance-public` bucket uchun brauzer VA Next
 *     server (next/image) ikkisi ham bir xil ishlatadigan doimiy origin
 *     (masalan `http://localhost:8080` dev'da, prod'da sayt domeni). Bu
 *     origin'dagi `/ecobalance-public/...` yo'li nginx/Caddy orqali MinIO'ga
 *     proksi qilinadi — MinIO'ni alohida host portga chiqarish shart emas,
 *     shuning uchun server (konteyner ichidan) ham brauzer ham bir xil
 *     manzildan rasmni topa oladi.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: S3Client;
  private signingClient!: S3Client;
  private bucket!: string;
  private publicBucket!: string;
  private publicEndpoint!: string;
  private publicAssetOrigin!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const endpoint = this.config.get<string>('S3_ENDPOINT', 'http://minio:9000');
    const publicEndpoint = this.config.get<string>('S3_PUBLIC_ENDPOINT', endpoint);
    this.bucket = this.config.get<string>('S3_BUCKET_PRIVATE', 'ecobalance-private');
    this.publicBucket = this.config.get<string>('S3_BUCKET_PUBLIC', 'ecobalance-public');
    this.publicEndpoint = publicEndpoint;
    this.publicAssetOrigin = this.config.get<string>('PUBLIC_ASSET_ORIGIN', 'http://localhost:8080');
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    if (
      nodeEnv === 'production' &&
      (this.publicAssetOrigin.includes('CHANGE_ME') ||
        this.publicAssetOrigin.includes('localhost') ||
        this.publicAssetOrigin.trim().length === 0)
    ) {
      // deploy-tekshiruv-prompt.md 3-band — bu CHANGE_ME/localhost'da qolib
      // ketsa, barcha yuklangan rasm manzillari browserga noto'g'ri qaytadi
      // (sayt domenidagi foydalanuvchi uni ochib bo'lmaydi). Jarayonni
      // to'xtatmaymiz (boot'ni buzmaslik uchun) — lekin baland ovozda ogohlantiramiz.
      this.logger.error(
        `PUBLIC_ASSET_ORIGIN prod muhitda noto'g'ri sozlangan: "${this.publicAssetOrigin}". ` +
          `.env'da haqiqiy sayt domenini qo'ying (masalan https://eco-balance.uz) — ` +
          `aks holda bosh sahifa kartalari uchun yuklangan rasmlar brauzerda ochilmaydi.`,
      );
    }
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const credentials = {
      accessKeyId: this.config.get<string>('S3_ACCESS_KEY', 'ecobalance'),
      secretAccessKey: this.config.get<string>('S3_SECRET_KEY', 'ecobalance'),
    };
    // Server-side op'lar uchun ichki manzil bilan client
    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials,
    });
    // Brauzerga qaytariladigan presigned URL'lar uchun tashqi manzil bilan client
    this.signingClient =
      publicEndpoint === endpoint
        ? this.client
        : new S3Client({
            region,
            endpoint: publicEndpoint,
            forcePathStyle: true,
            credentials,
          });
    this.logger.log(
      `S3 client initialised: internal=${endpoint} public=${publicEndpoint} bucket=${this.bucket}`,
    );
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * `ecobalance-public` bucket'ga yuklaydi (anonim o'qishga ochiq — minio-init
   * shu bucket'ni `mc anonymous set download` bilan sozlaydi). Signing'siz —
   * muddati tugaydigan presigned URL emas, doimiy ochiq fayl.
   * Chaqiruvchi faqat `key`ni saqlashi kerak (DB'da) — to'liq URL har doim
   * `getPublicUrl(key)` bilan HOZIRGI `PUBLIC_ASSET_ORIGIN`dan qayta hisoblanadi,
   * shunda origin o'zgarsa (domen, port) eski yozuvlar buzilmaydi.
   */
  async uploadPublic(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.publicBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deletePublic(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.publicBucket, Key: key }));
  }

  getPublicUrl(key: string): string {
    return `${this.publicAssetOrigin}/${this.publicBucket}/${key}`;
  }

  /**
   * Presigned URL valid for `ttlSeconds` (default 5 minutes).
   * Client redirects/downloads directly from MinIO — server not proxying the bytes.
   */
  async getDownloadUrl(key: string, fileName: string, ttlSeconds = 300): Promise<string> {
    const url = await getSignedUrl(
      this.signingClient,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
      }),
      { expiresIn: ttlSeconds },
    );
    return url;
  }
}
