export const TARGET_PLATFORMS = [
  'youtube_shorts',
  'instagram_reels',
  'tiktok',
  'youtube_long',
  'linkedin',
  'custom',
] as const;

export type TargetPlatform = (typeof TARGET_PLATFORMS)[number];

export const ASPECT_RATIOS = ['9:16', '16:9', '1:1'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const PLATFORM_ASPECT_RATIOS: Record<TargetPlatform, AspectRatio> = {
  youtube_shorts: '9:16',
  instagram_reels: '9:16',
  tiktok: '9:16',
  youtube_long: '16:9',
  linkedin: '1:1',
  custom: '9:16',
};

export const TONES = [
  'informative',
  'energetic',
  'friendly',
  'professional',
  'humorous',
  'inspirational',
  'calm',
] as const;
export type Tone = (typeof TONES)[number];

export const LANGUAGES = [
  'en',
  'hi',
  'te',
  'ta',
  'es',
  'fr',
  'de',
  'pt',
  'ar',
  'ja',
] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  hi: 'Hindi (हिंदी)',
  te: 'Telugu (తెలుగు)',
  ta: 'Tamil (தமிழ்)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  pt: 'Portuguese (Português)',
  ar: 'Arabic (العربية)',
  ja: 'Japanese (日本語)',
};

export const VISUAL_STYLES = [
  'photorealistic',
  'flat_illustration',
  '3d_render',
  'watercolor',
  'cinematic',
  'minimal_infographic',
  'anime',
] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

