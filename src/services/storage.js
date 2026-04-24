import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { bucketConfigured, env } from "../config/env.js";

const client = bucketConfigured
  ? new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY
      },
      forcePathStyle: true
    })
  : null;

function ensureBucket() {
  if (!client) {
    throw new Error("Bucket storage is not configured.");
  }

  return client;
}

async function uploadPdf(buffer, key) {
  const s3 = ensureBucket();

  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf"
    })
  );
}

async function deletePdf(key) {
  if (!client) {
    return;
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key
    })
  );
}

async function getPdfUrl(key) {
  if (env.S3_PUBLIC_BASE_URL) {
    return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }

  const s3 = ensureBucket();

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key
    }),
    { expiresIn: 60 * 10 }
  );
}

async function getPdfBuffer(key) {
  if (client) {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key
      })
    );

    return Buffer.from(await response.Body.transformToByteArray());
  }

  if (env.S3_PUBLIC_BASE_URL) {
    const response = await fetch(getPublicPdfUrl(key));

    if (!response.ok) {
      throw new Error(`Unable to fetch PDF ${key}.`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error("Bucket storage is not configured.");
}

function getPublicPdfUrl(key) {
  return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}

export { deletePdf, getPdfBuffer, getPdfUrl, uploadPdf };
