import { z } from 'zod';

export const CameraMotionEnum = z.enum([
  'static',
  'slow_zoom_in',
  'slow_zoom_out',
  'pan_left',
  'pan_right',
  'tilt_up',
  'tilt_down',
]);
export type CameraMotion = z.infer<typeof CameraMotionEnum>;

export const TransitionEnum = z.enum(['cut', 'fade', 'slide', 'zoom', 'dissolve']);
export type Transition = z.infer<typeof TransitionEnum>;

export const AnalysisOutputSchema = z.object({
  suggested_title: z.string().min(3).max(120),
  summary: z.string().min(50).max(1200),
  detected_topic: z.string().min(2).max(80),
  key_points: z.array(z.string().min(5).max(240)).min(3).max(12),
  audience_insights: z.object({
    primary_audience: z.string().min(2).max(200),
    knowledge_level: z.enum(['beginner', 'intermediate', 'advanced']),
    pain_points: z.array(z.string().max(200)).max(6),
  }),
  recommended_structure: z
    .array(
      z.object({
        beat: z.enum(['hook', 'context', 'point', 'example', 'recap', 'cta']),
        description: z.string().min(5).max(240),
      })
    )
    .min(3)
    .max(12),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

export const SceneOutputSchema = z.object({
  scene_index: z.number().int().min(0),
  duration_seconds: z.number().min(1).max(30),
  narration: z.string().min(5).max(600),
  on_screen_text: z.string().max(80),
  visual_description: z.string().min(10).max(500),
  image_prompt: z.string().min(20).max(700),
  camera_motion: CameraMotionEnum,
  transition: TransitionEnum,
  mood: z.string().max(60),
  music_cue: z.string().max(120),
});
export type SceneOutput = z.infer<typeof SceneOutputSchema>;

export const ScriptOutputSchema = z
  .object({
    video_title: z.string().min(3).max(120),
    hook: z.string().min(5).max(240),
    scenes: z.array(SceneOutputSchema).min(3).max(24),
    call_to_action: z.string().max(200),
    caption_text: z.string().max(2200),
    hashtags: z.array(z.string().min(2).max(40)).min(0).max(15),
    advisory_note: z.string().max(300),
  })
  .superRefine((v, ctx) => {
    v.scenes.forEach((s, i) => {
      if (s.scene_index !== i) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'scene_index must be sequential from 0',
          path: ['scenes', i, 'scene_index'],
        });
      }
    });
  });
export type ScriptOutput = z.infer<typeof ScriptOutputSchema>;

// Feature 1: Idea-to-Video Expansion
export const ExpandIdeaResponseSchema = z.object({
  title: z.string().min(3).max(120),
  domain: z.string(),
  target_platform: z.string(),
  aspect_ratio: z.enum(['9:16', '16:9', '1:1']),
  target_duration_seconds: z.number().int().min(15).max(180),
  tone: z.string(),
  audience: z.string(),
  visual_style: z.string(),
  expanded_source_text: z.string().min(200).max(60000),
  key_takeaways: z.array(z.string()).min(2).max(8),
});
export type ExpandIdeaResponse = z.infer<typeof ExpandIdeaResponseSchema>;

// Feature 2: Document Topics Extraction
export const DocumentTopicsResponseSchema = z.object({
  document_summary: z.string(),
  detected_subject: z.string(),
  topics: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      key_concepts: z.array(z.string()),
    })
  ).min(1).max(10),
});
export type DocumentTopicsResponse = z.infer<typeof DocumentTopicsResponseSchema>;

// Feature 7: Quality and Fact-Checking Audit
export const QualityAuditResponseSchema = z.object({
  quality_score: z.number().min(0).max(100),
  hook_score: z.number().min(0).max(100),
  readability_score: z.number().min(0).max(100),
  overall_feedback: z.string(),
  factual_checks: z.array(
    z.object({
      claim: z.string(),
      status: z.enum(['supported', 'unverified_in_source']),
      notes: z.string(),
    })
  ),
  clarity_issues: z.array(
    z.object({
      scene_index: z.number(),
      issue: z.string(),
      suggestion: z.string(),
    })
  ),
  repetitive_phrases: z.array(z.string()),
  actionable_improvements: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      auto_applicable: z.boolean(),
      edit_type: z.enum(['hook', 'scene_narration', 'pacing']),
      target_scene_index: z.number().optional(),
      proposed_text: z.string().optional(),
    })
  ),
});
export type QualityAuditResponse = z.infer<typeof QualityAuditResponseSchema>;

// Feature 6: Video Repurposing
export const RepurposeResponseSchema = z.object({
  shorts_script: z.object({
    hook: z.string(),
    narration: z.string(),
    duration_seconds: z.number(),
    target_platform: z.string(),
  }),
  alternative_hooks: z.array(
    z.object({
      style: z.string(),
      hook: z.string(),
      rationale: z.string(),
    })
  ).min(3).max(8),
  social_posts: z.array(
    z.object({
      platform: z.enum(['youtube', 'instagram', 'linkedin', 'x_twitter']),
      caption: z.string(),
      hashtags: z.array(z.string()),
    })
  ),
  key_point_summary: z.array(z.string()).min(3).max(10),
});
export type RepurposeResponse = z.infer<typeof RepurposeResponseSchema>;

// Feature 4: Copilot Assistant
export const CopilotResponseSchema = z.object({
  reply: z.string(),
  suggested_action: z.enum(['none', 'update_hook', 'update_scene', 'regenerate_all']).default('none'),
  action_payload: z
    .object({
      hook: z.string().optional(),
      scene_index: z.number().optional(),
      narration: z.string().optional(),
      visual_description: z.string().optional(),
      on_screen_text: z.string().optional(),
    })
    .optional(),
});
export type CopilotResponse = z.infer<typeof CopilotResponseSchema>;


