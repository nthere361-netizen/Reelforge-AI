import { describe, it, expect } from 'vitest';
import { VideoConfigSchema } from './schemas/config.js';
import { ScriptOutputSchema, AnalysisOutputSchema } from './schemas/ai.js';

describe('Shared Schemas', () => {
  it('validates a correct video config', () => {
    const valid = {
      title: 'How to Grow Organic Tomatoes',
      domain: 'agriculture',
      target_platform: 'youtube_shorts',
      aspect_ratio: '9:16',
      target_duration_seconds: 45,
      tone: 'informative',
      language: 'en',
      audience: 'Hobby farmers',
      voice_name: 'Kore',
      visual_style: 'photorealistic',
      include_cta: true,
      extra_instructions: '',
    };
    const res = VideoConfigSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('rejects short form platforms exceeding 90 seconds', () => {
    const invalid = {
      title: 'Long Shorts Video',
      target_platform: 'youtube_shorts',
      target_duration_seconds: 120,
    };
    const res = VideoConfigSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it('validates script output schema and sequential scene indexes', () => {
    const script = {
      video_title: 'Title',
      hook: 'Hook sentence',
      scenes: [
        {
          scene_index: 0,
          duration_seconds: 5,
          narration: 'Hello world narration',
          on_screen_text: 'Hello',
          visual_description: 'Visual description of scene',
          image_prompt: 'High resolution image prompt in photorealistic style',
          camera_motion: 'slow_zoom_in',
          transition: 'cut',
          mood: 'bright',
          music_cue: 'acoustic guitar',
        },
        {
          scene_index: 1,
          duration_seconds: 6,
          narration: 'Second scene narration',
          on_screen_text: 'Step 1',
          visual_description: 'Visual description of scene 2',
          image_prompt: 'High resolution image prompt in photorealistic style',
          camera_motion: 'pan_left',
          transition: 'fade',
          mood: 'curious',
          music_cue: 'subtle drums',
        },
        {
          scene_index: 2,
          duration_seconds: 5,
          narration: 'Third scene narration with cta',
          on_screen_text: 'Follow us',
          visual_description: 'Visual description of final scene',
          image_prompt: 'High resolution image prompt in photorealistic style',
          camera_motion: 'static',
          transition: 'cut',
          mood: 'cheerful',
          music_cue: 'uplifting finale',
        },
      ],
      call_to_action: 'Subscribe now',
      caption_text: 'Learn how today! #farming #garden',
      hashtags: ['farming', 'organic', 'tomatoes'],
      advisory_note: 'Consult your local extension officer.',
    };
    const res = ScriptOutputSchema.safeParse(script);
    expect(res.success).toBe(true);
  });
});

