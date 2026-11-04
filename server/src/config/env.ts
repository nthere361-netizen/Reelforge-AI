import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const rawClientOrigin = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173';
const rawAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_ORIGIN: z.string().default(rawClientOrigin),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1).default(rawAnonKey),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  GEMINI_API_KEY: z.string().min(1),
  GEMINI_TEXT_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_TTS_MODEL: z.string().default('gemini-2.5-flash-preview-tts'),
  GEMINI_IMAGE_MODEL: z.string().default('gemini-2.5-flash-image'),

  DAILY_AI_QUOTA_PER_USER: z.coerce.number().default(40),
  MEDIA_CONCURRENCY: z.coerce.number().default(3),
  MAX_SOURCE_CHARS: z.coerce.number().default(60000),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().default(3600),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid or missing environment variables:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

export const env = parsed.success
  ? parsed.data
  : (process.env as unknown as z.infer<typeof EnvSchema>);

