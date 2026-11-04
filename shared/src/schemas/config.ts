import { z } from 'zod';
import { DOMAIN_KEYS } from '../constants/domains.js';
import {
  TARGET_PLATFORMS,
  ASPECT_RATIOS,
  TONES,
  LANGUAGES,
  VISUAL_STYLES,
} from '../constants/platforms.js';
import { VOICE_NAMES } from '../constants/voices.js';

export const BaseVideoConfigSchema = z.object({
  title: z.string().min(3).max(120),
  domain: z.enum(DOMAIN_KEYS).default('general'),
  target_platform: z.enum(TARGET_PLATFORMS).default('youtube_shorts'),
  aspect_ratio: z.enum(ASPECT_RATIOS).default('9:16'),
  target_duration_seconds: z.coerce.number().int().min(15).max(180).default(45),
  tone: z.enum(TONES).default('informative'),
  language: z.enum(LANGUAGES).default('en'),
  audience: z.string().max(200).default(''),
  voice_name: z.enum(VOICE_NAMES).default('Kore'),
  visual_style: z.enum(VISUAL_STYLES).default('cinematic'),
  include_cta: z.boolean().default(true),
  extra_instructions: z.string().max(500).default(''),
});

export const VideoConfigSchema = BaseVideoConfigSchema.superRefine((data, ctx) => {
  const shortFormPlatforms = ['youtube_shorts', 'tiktok', 'instagram_reels'];
  if (shortFormPlatforms.includes(data.target_platform) && data.target_duration_seconds > 90) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${data.target_platform} duration cannot exceed 90 seconds.`,
      path: ['target_duration_seconds'],
    });
  }
});

export type VideoConfig = z.infer<typeof VideoConfigSchema>;
