import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../core/env.js';
import { AppError } from '../../core/errors.js';

let s3Client: S3Client | null = null;

function getR2Config() {
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET_NAME
  ) {
    throw new AppError(
      'Almacenamiento Cloudflare R2 no configurado en el servidor',
      503,
      'STORAGE_NOT_CONFIGURED',
    );
  }

  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
  };
}

function getS3Client(): { client: S3Client; bucket: string } {
  const cfg = getR2Config();
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return { client: s3Client, bucket: cfg.bucket };
}

export const r2KeyBuilders = {
  campaignImage: (campaignId: string, fileName: string) =>
    `campaigns/${campaignId}/images/${Date.now()}-${sanitizeFileName(fileName)}`,
  prizeImage: (prizeId: string, fileName: string) =>
    `prizes/${prizeId}/images/${Date.now()}-${sanitizeFileName(fileName)}`,
  passFile: (passId: string, fileName: string) =>
    `passes/${passId}/files/${Date.now()}-${sanitizeFileName(fileName)}`,
  paymentProof: (paymentId: string, fileName: string) =>
    `payments/${paymentId}/proofs/${Date.now()}-${sanitizeFileName(fileName)}`,
  backup: (campaignId: string, fileName: string) =>
    `backups/${campaignId}/${Date.now()}-${sanitizeFileName(fileName)}`,
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

export async function uploadObject(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ key: string }> {
  const { client, bucket } = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
  return { key: params.key };
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

export async function getSignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<{ uploadUrl: string; key: string; expiresInSeconds: number }> {
  const { client, bucket } = getS3Client();
  const expiresInSeconds = params.expiresInSeconds ?? 300;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return { uploadUrl, key: params.key, expiresInSeconds };
}

export async function getSignedDownloadUrl(params: {
  key: string;
  expiresInSeconds?: number;
  downloadFileName?: string;
}): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
  const { client, bucket } = getS3Client();
  const expiresInSeconds = params.expiresInSeconds ?? 300;
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ...(params.downloadFileName
      ? { ResponseContentDisposition: `attachment; filename="${sanitizeFileName(params.downloadFileName)}"` }
      : {}),
  });
  const downloadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return { downloadUrl, expiresInSeconds };
}

export async function getObjectMetadata(key: string): Promise<{
  contentType?: string;
  contentLength?: number;
  eTag?: string;
}> {
  const { client, bucket } = getS3Client();
  const head = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
  return {
    contentType: head.ContentType,
    contentLength: head.ContentLength,
    eTag: head.ETag,
  };
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const { client, bucket } = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new AppError('El archivo en R2 no tiene contenido', 502, 'R2_EMPTY_OBJECT');
  }

  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}
