import { describe, it, expect } from 'vitest';
import { normalizeScriptData, performSemanticChecks } from '../ai/semanticChecks.js';
import { ScriptOutput } from '@reelforge/shared';

describe('AI Core & Semantic Checks', () => {
  it('normalizes script fields, cleans hashtags, and clamps durations', () => {
    const raw = {
      video_title: '  Test Title  ',
      hook: '  Opening hook sentence  ',
      call_to_action: '  Follow for more  ',
      caption_text: '  Social caption  ',
      hashtags: ['#AgTech', '#farming', 'FARMING', 'a'], // duplicates and leading #
      scenes: [
        {
          scene_index: 99, // non-sequential
          duration_seconds: 45, // exceeds 30
          narration: '  Narration for scene  ',
          on_screen_text: '  Text  ',
          visual_description: '  Visual  ',
          image_prompt: '  Prompt  ',
          camera_motion: 'static',
          transition: 'cut',
          mood: 'bright',
          music_cue: 'guitar',
        },
      ],
      advisory_note: '  Note  ',
    };

    const normalized = normalizeScriptData(raw);
    expect(normalized.video_title).toBe('Test Title');
    expect(normalized.hashtags).toEqual(['agtech', 'farming']);
    expect(normalized.scenes[0].scene_index).toBe(0);
    expect(normalized.scenes[0].duration_seconds).toBe(30); // clamped to 30
  });

  it('rescales scene durations proportionally when total duration is off by >15%', () => {
    const script: ScriptOutput = {
      video_title: 'Title',
      hook: 'Hook',
      call_to_action: 'CTA',
      caption_text: 'Caption',
      hashtags: ['test'],
      advisory_note: '',
      scenes: [
        {
          scene_index: 0,
          duration_seconds: 10,
          narration: 'Scene one narration text here.',
          on_screen_text: 'One',
          visual_description: 'Visual description 1',
          image_prompt: 'High quality image prompt 1',
          camera_motion: 'slow_zoom_in',
          transition: 'cut',
          mood: 'energetic',
          music_cue: 'beat',
        },
        {
          scene_index: 1,
          duration_seconds: 10,
          narration: 'Scene two narration text here.',
          on_screen_text: 'Two',
          visual_description: 'Visual description 2',
          image_prompt: 'High quality image prompt 2',
          camera_motion: 'slow_zoom_out',
          transition: 'fade',
          mood: 'calm',
          music_cue: 'strings',
        },
        {
          scene_index: 2,
          duration_seconds: 10,
          narration: 'Scene three narration text here.',
          on_screen_text: 'Three',
          visual_description: 'Visual description 3',
          image_prompt: 'High quality image prompt 3',
          camera_motion: 'static',
          transition: 'cut',
          mood: 'inspirational',
          music_cue: 'outro',
        },
      ],
    };

    // Target is 45s, total is 30s (off by 33%, which is > 15%)
    const res = performSemanticChecks(script, 45, 3, 10);
    const total = res.scenes.reduce((sum, s) => sum + s.duration_seconds, 0);
    expect(total).toBeCloseTo(45, 1);
  });

  it('rejects script with scene count outside min/max range', () => {
    const script: ScriptOutput = {
      video_title: 'Title',
      hook: 'Hook',
      call_to_action: '',
      caption_text: '',
      hashtags: [],
      advisory_note: '',
      scenes: [
        {
          scene_index: 0,
          duration_seconds: 5,
          narration: 'Scene 0',
          on_screen_text: '',
          visual_description: 'V0',
          image_prompt: 'P0',
          camera_motion: 'static',
          transition: 'cut',
          mood: '',
          music_cue: '',
        },
      ],
    };
    expect(() => performSemanticChecks(script, 45, 3, 12)).toThrow(/outside allowed range/);
  });
});

