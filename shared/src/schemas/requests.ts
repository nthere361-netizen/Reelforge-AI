import { z } from 'zod';
import { BaseVideoConfigSchema } from './config.js';
import { CameraMotionEnum, TransitionEnum } from './ai.js';
import { DOMAIN_KEYS } from '../constants/domains.js';
import { LANGUAGES } from '../constants/platforms.js';
import { VOICE_NAMES } from '../constants/voices.js';

export const FetchUrlRequestSchema = z
  .object({
    url: z.string().url(),
  })
  .strict();
export type FetchUrlRequest = z.infer<typeof FetchUrlRequestSchema>;

export const CreateProjectRequestSchema = BaseVideoConfigSchema.extend({
  source_type: z.enum(['paste', 'url', 'file']),
  source_url: z.string().url().optional(),
  source_filename: z.string().optional(),
  source_text: z.string().min(200).max(60000),
})
  .strict()
  .superRefine((data, ctx) => {
    const shortFormPlatforms = ['youtube_shorts', 'tiktok', 'instagram_reels'];
    if (shortFormPlatforms.includes(data.target_platform) && data.target_duration_seconds > 90) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${data.target_platform} duration cannot exceed 90 seconds.`,
        path: ['target_duration_seconds'],
      });
    }
  });
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const UpdateProjectRequestSchema = BaseVideoConfigSchema.partial().strict();
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;

export const SceneEditSchema = z
  .object({
    narration: z.string().min(5).max(600).optional(),
    on_screen_text: z.string().max(80).optional(),
    visual_description: z.string().min(10).max(500).optional(),
    image_prompt: z.string().min(20).max(700).optional(),
    duration_seconds: z.coerce.number().min(1).max(30).optional(),
    camera_motion: CameraMotionEnum.optional(),
    transition: TransitionEnum.optional(),
    mood: z.string().max(60).optional(),
    music_cue: z.string().max(120).optional(),
  })
  .strict();
export type SceneEdit = z.infer<typeof SceneEditSchema>;

export const AddSceneSchema = z
  .object({
    narration: z.string().min(5).max(600),
    on_screen_text: z.string().max(80).default(''),
    visual_description: z.string().min(10).max(500),
    image_prompt: z.string().min(20).max(700),
    duration_seconds: z.coerce.number().min(1).max(30).default(5),
    camera_motion: CameraMotionEnum.default('slow_zoom_in'),
    transition: TransitionEnum.default('cut'),
    mood: z.string().max(60).default(''),
    music_cue: z.string().max(120).default(''),
    insert_after_index: z.number().int().min(-1).optional(),
  })
  .strict();
export type AddScene = z.infer<typeof AddSceneSchema>;

export const ReorderScenesSchema = z
  .object({
    ordered_scene_ids: z.array(z.string().uuid()).min(1),
  })
  .strict();
export type ReorderScenes = z.infer<typeof ReorderScenesSchema>;

export const RegenerateSceneSchema = z
  .object({
    instruction: z.string().max(500).optional(),
  })
  .strict();
export type RegenerateScene = z.infer<typeof RegenerateSceneSchema>;

export const ScriptGenerateSchema = z
  .object({
    extra_instructions: z.string().max(500).optional(),
  })
  .strict();
export type ScriptGenerate = z.infer<typeof ScriptGenerateSchema>;

export const UpdateProfileSchema = z
  .object({
    full_name: z.string().max(100).optional(),
    role: z.enum(['creator', 'marketer', 'educator']).optional(),
    default_domain: z.enum(DOMAIN_KEYS).optional(),
    default_language: z.enum(LANGUAGES).optional(),
    default_voice: z.enum(VOICE_NAMES).optional(),
  })
  .strict();
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

export const ExpandIdeaRequestSchema = z
  .object({
    idea: z.string().min(3, 'Idea must be at least 3 characters').max(1000),
    preferred_domain: z.string().optional(),
    preferred_platform: z.string().optional(),
  })
  .strict();
export type ExpandIdeaRequest = z.infer<typeof ExpandIdeaRequestSchema>;

export const DocumentTopicsRequestSchema = z
  .object({
    text: z.string().min(50).max(60000),
  })
  .strict();
export type DocumentTopicsRequest = z.infer<typeof DocumentTopicsRequestSchema>;

export const TranslateScriptRequestSchema = z
  .object({
    target_language: z.enum(LANGUAGES),
  })
  .strict();
export type TranslateScriptRequest = z.infer<typeof TranslateScriptRequestSchema>;

export const CopilotRequestSchema = z
  .object({
    message: z.string().min(1).max(2000),
    scene_index: z.number().int().min(0).optional(),
    action_type: z.enum(['chat', 'simplify', 'punchy_hook', 'change_tone', 'fix_grammar']).default('chat'),
  })
  .strict();
export type CopilotRequest = z.infer<typeof CopilotRequestSchema>;

