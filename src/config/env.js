import dotenv from "dotenv";
import slugify from "slugify";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  SESSION_SECRET: z.string().min(1),
  APP_URL: z.string().url(),
  ADMIN_EMAILS: z.string().default(""),
  LABS: z.string().default(""),
  PUBLIC_NOTES: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  MICROSOFT_CLIENT_ID: z.string().default(""),
  MICROSOFT_CLIENT_SECRET: z.string().default(""),
  MICROSOFT_TENANT_ID: z.string().default("common"),
  MICROSOFT_CALLBACK_PATH: z.string().default("/auth/microsoft/callback"),
  S3_ENDPOINT: z.string().default(""),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().default(""),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  S3_PUBLIC_BASE_URL: z.string().default(""),
});

const env = envSchema.parse(process.env);

const adminEmails = env.ADMIN_EMAILS.split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const configuredLabs = env.LABS.split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    const [namePart, slugPart] = value.split(":").map((item) => item.trim());
    const name = namePart;
    const slug = slugify(slugPart || namePart, {
      lower: true,
      strict: true,
      trim: true
    });

    return { name, slug };
  })
  .filter(
    (lab, index, labs) =>
      lab.slug &&
      labs.findIndex((candidate) => candidate.slug === lab.slug) === index
  );

const microsoftConfigured =
  Boolean(env.MICROSOFT_CLIENT_ID) && Boolean(env.MICROSOFT_CLIENT_SECRET);

const bucketConfigured =
  Boolean(env.S3_ENDPOINT) &&
  Boolean(env.S3_BUCKET) &&
  Boolean(env.S3_ACCESS_KEY_ID) &&
  Boolean(env.S3_SECRET_ACCESS_KEY);

export {
  adminEmails,
  bucketConfigured,
  configuredLabs,
  env,
  microsoftConfigured
};
