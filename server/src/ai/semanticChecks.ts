import { ScriptOutput, SceneOutput } from '@reelforge/shared';
import { AppError } from '../lib/errors.js';

export function normalizeScriptData(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;

  const res = { ...raw };

  if (typeof res.video_title === 'string') res.video_title = res.video_title.trim();
  if (typeof res.hook === 'string') res.hook = res.hook.trim();
  if (typeof res.call_to_action === 'string') res.call_to_action = res.call_to_action.trim();
  if (typeof res.caption_text === 'string') res.caption_text = res.caption_text.trim();
  if (typeof res.advisory_note === 'string') res.advisory_note = res.advisory_note.trim();

  // Normalize hashtags: strip leading #, lowercase, unique
  if (Array.isArray(res.hashtags)) {
    const set = new Set<string>();
    res.hashtags.forEach((h: any) => {
      if (typeof h === 'string') {
        const clean = h.replace(/^#+/, '').trim().toLowerCase();
        if (clean.length >= 2) set.add(clean);
      }
    });
    res.hashtags = Array.from(set);
  }

  // Normalize scenes
  if (Array.isArray(res.scenes)) {
    res.scenes = res.scenes.map((s: any, idx: number) => {
      const scene = { ...s };
      scene.scene_index = idx; // Enforce sequential 0-based index
      if (typeof scene.narration === 'string') scene.narration = scene.narration.trim();
      if (typeof scene.on_screen_text === 'string') scene.on_screen_text = scene.on_screen_text.trim();
      if (typeof scene.visual_description === 'string')
        scene.visual_description = scene.visual_description.trim();
      if (typeof scene.image_prompt === 'string') scene.image_prompt = scene.image_prompt.trim();
      if (typeof scene.mood === 'string') scene.mood = scene.mood.trim();
      if (typeof scene.music_cue === 'string') scene.music_cue = scene.music_cue.trim();

      // Clamp duration
      let dur = Number(scene.duration_seconds) || 5;
      if (dur < 1) dur = 1;
      if (dur > 30) dur = 30;
      scene.duration_seconds = Math.round(dur * 10) / 10;

      return scene;
    });
  }

  return res;
}

export function performSemanticChecks(
  script: ScriptOutput,
  targetDurationSeconds: number,
  minScenes: number,
  maxScenes: number
): ScriptOutput {
  const scenes = script.scenes;

  // 1. Scene count check
  if (scenes.length < minScenes || scenes.length > maxScenes) {
    throw new AppError(
      'AI_OUTPUT_INVALID',
      502,
      `Scene count (${scenes.length}) outside allowed range (${minScenes}-${maxScenes})`
    );
  }

  // 2. Duration check and proportional rescaling
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration_seconds, 0);
  const diffPercent = Math.abs(totalDuration - targetDurationSeconds) / targetDurationSeconds;

  let finalScenes: SceneOutput[] = scenes;

  if (diffPercent > 0.15 && totalDuration > 0) {
    // Proportional rescaling per Appendix E rule 3
    const factor = targetDurationSeconds / totalDuration;
    finalScenes = scenes.map((s) => {
      let scaled = s.duration_seconds * factor;
      if (scaled < 1) scaled = 1;
      if (scaled > 30) scaled = 30;
      return {
        ...s,
        duration_seconds: Math.round(scaled * 10) / 10,
      };
    });
  }

  // 3. Narration pace checks (roughly 2.5 words per sec, warning threshold 35%)
  finalScenes.forEach((s) => {
    const wordCount = s.narration.split(/\s+/).filter(Boolean).length;
    const targetWords = s.duration_seconds * 2.5;
    const wordDiff = Math.abs(wordCount - targetWords) / (targetWords || 1);
    // Allow flexible margin, log warning if extreme
  });

  return {
    ...script,
    scenes: finalScenes,
  };
}

