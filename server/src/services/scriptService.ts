import { SupabaseClient } from '@supabase/supabase-js';
import {
  ScriptOutput,
  ScriptOutputSchema,
  SceneOutput,
  SceneOutputSchema,
  QualityAuditResponse,
  QualityAuditResponseSchema,
  RepurposeResponse,
  RepurposeResponseSchema,
  CopilotResponse,
  CopilotResponseSchema,
} from '@reelforge/shared';
import { generateStructured } from '../lib/gemini.js';
import { buildSystemPrompt } from '../ai/systemPrompt.js';
import {
  buildScriptPrompt,
  buildSceneRegenPrompt,
  buildTranslatePrompt,
  buildQualityAuditPrompt,
  buildRepurposePrompt,
  buildCopilotPrompt,
} from '../ai/prompts.js';
import { normalizeScriptData, performSemanticChecks } from '../ai/semanticChecks.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export class ScriptService {
  /**
   * Generates a new script version for the project, persists scenes, and marks as active.
   */
  static async generateScript(
    projectId: string,
    userId: string,
    supabase: SupabaseClient,
    extraInstructions?: string
  ): Promise<{ script: any; scenes: any[] }> {
    const startTime = Date.now();

    // 1. Fetch project and analysis
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projErr || !project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const { data: analysis, error: analysisErr } = await supabase
      .from('content_analyses')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (analysisErr || !analysis) {
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        'Project content analysis is required before generating a script'
      );
    }

    // 2. Compute scene count target bounds (rough rule: 5-8 seconds per scene)
    const targetSeconds = project.target_duration_seconds;
    const minScenes = Math.max(3, Math.floor(targetSeconds / 8));
    const maxScenes = Math.min(24, Math.ceil(targetSeconds / 5));

    // 3. Prepare AI prompt
    const systemInstruction = buildSystemPrompt({
      domain: project.domain,
      tone: project.tone,
      audience: project.audience,
      platform: project.target_platform,
      aspect_ratio: project.aspect_ratio,
      visual_style: project.visual_style,
    });

    const combinedExtra = [project.extra_instructions, extraInstructions]
      .filter(Boolean)
      .join('. ');

    const prompt = buildScriptPrompt({
      target_duration_seconds: targetSeconds,
      min_scenes: minScenes,
      max_scenes: maxScenes,
      language: project.language,
      include_cta: project.include_cta,
      analysis_json: JSON.stringify({
        suggested_title: analysis.suggested_title,
        summary: analysis.summary,
        key_points: analysis.key_points,
        recommended_structure: analysis.recommended_structure,
      }),
      extra_instructions: combinedExtra,
      source_text: project.source_text,
    });

    let rawScript: ScriptOutput;
    let logStatus: 'success' | 'validation_failed' | 'api_error' = 'success';
    let errorCode: string | undefined;

    try {
      rawScript = await generateStructured({
        schema: ScriptOutputSchema,
        systemInstruction,
        prompt,
      });
    } catch (err: any) {
      logStatus = err?.code === 'AI_OUTPUT_INVALID' ? 'validation_failed' : 'api_error';
      errorCode = err?.code || 'UNKNOWN';
      throw err;
    } finally {
      const latencyMs = Date.now() - startTime;
      await supabase.from('generation_logs').insert({
        user_id: userId,
        project_id: projectId,
        operation: 'script',
        model: env.GEMINI_TEXT_MODEL,
        status: logStatus,
        latency_ms: latencyMs,
        error_code: errorCode,
      });
    }

    // 4. Normalization and semantic checks
    const normalized = normalizeScriptData(rawScript);
    const validatedScript = performSemanticChecks(
      normalized,
      targetSeconds,
      minScenes,
      maxScenes
    );

    // 5. Determine new version number
    const { data: existingScripts } = await supabase
      .from('scripts')
      .select('version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existingScripts && existingScripts.length > 0 ? existingScripts[0].version + 1 : 1;

    // Deactivate previous active scripts
    await supabase.from('scripts').update({ is_active: false }).eq('project_id', projectId);

    const totalDurationSeconds = Math.round(
      validatedScript.scenes.reduce((sum, s) => sum + s.duration_seconds, 0)
    );

    // 6. Insert new script row
    const { data: scriptRow, error: scriptInsertErr } = await supabase
      .from('scripts')
      .insert({
        project_id: projectId,
        user_id: userId,
        version: nextVersion,
        video_title: validatedScript.video_title,
        hook: validatedScript.hook,
        call_to_action: validatedScript.call_to_action,
        caption_text: validatedScript.caption_text,
        hashtags: validatedScript.hashtags,
        total_duration_seconds: totalDurationSeconds,
        advisory_note: validatedScript.advisory_note,
        model: env.GEMINI_TEXT_MODEL,
        is_active: true,
      })
      .select()
      .single();

    if (scriptInsertErr || !scriptRow) {
      logger.error({ scriptInsertErr }, 'Failed to insert script row');
      throw new AppError('INTERNAL', 500, 'Failed to save generated script');
    }

    // 7. Insert scene rows
    const scenesToInsert = validatedScript.scenes.map((s, idx) => ({
      script_id: scriptRow.id,
      project_id: projectId,
      user_id: userId,
      scene_index: idx,
      duration_seconds: s.duration_seconds,
      narration: s.narration,
      on_screen_text: s.on_screen_text,
      visual_description: s.visual_description,
      image_prompt: s.image_prompt,
      camera_motion: s.camera_motion,
      transition: s.transition,
      mood: s.mood,
      music_cue: s.music_cue,
    }));

    const { data: insertedScenes, error: scenesInsertErr } = await supabase
      .from('scenes')
      .insert(scenesToInsert)
      .select();

    if (scenesInsertErr || !insertedScenes) {
      logger.error({ scenesInsertErr }, 'Failed to insert scene rows');
      throw new AppError('INTERNAL', 500, 'Failed to save generated scenes');
    }

    // Update project status to scripted
    await supabase.from('projects').update({ status: 'scripted' }).eq('id', projectId);

    return {
      script: scriptRow,
      scenes: insertedScenes.sort((a, b) => a.scene_index - b.scene_index),
    };
  }

  /**
   * Regenerates a single scene using contextual neighbors and analysis plan.
   */
  static async regenerateScene(
    sceneId: string,
    userId: string,
    supabase: SupabaseClient,
    instruction?: string
  ): Promise<any> {
    const startTime = Date.now();

    // 1. Fetch current scene
    const { data: currentScene, error: scErr } = await supabase
      .from('scenes')
      .select('*, projects(*)')
      .eq('id', sceneId)
      .eq('user_id', userId)
      .single();

    if (scErr || !currentScene) {
      throw new AppError('NOT_FOUND', 404, 'Scene not found');
    }

    const project = currentScene.projects;
    const projectId = currentScene.project_id;
    const scriptId = currentScene.script_id;

    // 2. Fetch neighbor scenes
    const { data: allScenes } = await supabase
      .from('scenes')
      .select('*')
      .eq('script_id', scriptId)
      .order('scene_index', { ascending: true });

    const prevScene = allScenes?.find((s) => s.scene_index === currentScene.scene_index - 1);
    const nextScene = allScenes?.find((s) => s.scene_index === currentScene.scene_index + 1);

    // 3. Fetch analysis
    const { data: analysis } = await supabase
      .from('content_analyses')
      .select('summary')
      .eq('project_id', projectId)
      .single();

    const systemInstruction = buildSystemPrompt({
      domain: project.domain,
      tone: project.tone,
      audience: project.audience,
      platform: project.target_platform,
      aspect_ratio: project.aspect_ratio,
      visual_style: project.visual_style,
    });

    const prompt = buildSceneRegenPrompt({
      scene_index: currentScene.scene_index,
      instruction,
      current_duration: Number(currentScene.duration_seconds),
      prev_scene_json: prevScene ? JSON.stringify(prevScene) : undefined,
      current_scene_json: JSON.stringify(currentScene),
      next_scene_json: nextScene ? JSON.stringify(nextScene) : undefined,
      analysis_summary: analysis?.summary || '',
    });

    let newScene: SceneOutput;
    let logStatus: 'success' | 'validation_failed' | 'api_error' = 'success';
    let errorCode: string | undefined;

    try {
      newScene = await generateStructured({
        schema: SceneOutputSchema,
        systemInstruction,
        prompt,
      });
    } catch (err: any) {
      logStatus = err?.code === 'AI_OUTPUT_INVALID' ? 'validation_failed' : 'api_error';
      errorCode = err?.code || 'UNKNOWN';
      throw err;
    } finally {
      const latencyMs = Date.now() - startTime;
      await supabase.from('generation_logs').insert({
        user_id: userId,
        project_id: projectId,
        operation: 'regen_scene',
        model: env.GEMINI_TEXT_MODEL,
        status: logStatus,
        latency_ms: latencyMs,
        error_code: errorCode,
      });
    }

    // 4. Update scene in database
    const { data: updated, error: updErr } = await supabase
      .from('scenes')
      .update({
        narration: newScene.narration.trim(),
        on_screen_text: newScene.on_screen_text.trim(),
        visual_description: newScene.visual_description.trim(),
        image_prompt: newScene.image_prompt.trim(),
        duration_seconds: newScene.duration_seconds,
        camera_motion: newScene.camera_motion,
        transition: newScene.transition,
        mood: newScene.mood.trim(),
        music_cue: newScene.music_cue.trim(),
      })
      .eq('id', sceneId)
      .select()
      .single();

    if (updErr || !updated) {
      throw new AppError('INTERNAL', 500, 'Failed to update regenerated scene');
    }

    return updated;
  }

  /**
   * Feature 5: Multilingual Script Translation
   */
  static async translateScript(
    projectId: string,
    userId: string,
    supabase: SupabaseClient,
    targetLanguage: string
  ): Promise<{ script: any; scenes: any[] }> {
    // 1. Fetch project and active script
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const { data: activeScript } = await supabase
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    if (!activeScript) throw new AppError('NOT_FOUND', 404, 'Active script not found');

    const { data: scenes } = await supabase
      .from('scenes')
      .select('*')
      .eq('script_id', activeScript.id)
      .order('scene_index', { ascending: true });

    const fullScriptJson = JSON.stringify({
      ...activeScript,
      scenes: scenes || [],
    });

    const prompt = buildTranslatePrompt({
      script_json: fullScriptJson,
      target_language: targetLanguage,
    });

    const systemInstruction = `You are a professional multilingual media translator and subtitle localization expert. You translate video scripts naturally into ${targetLanguage} while strictly matching scene pacing, numbers, and sequence.`;

    const translated: ScriptOutput = await generateStructured({
      schema: ScriptOutputSchema,
      systemInstruction,
      prompt,
      temperature: 0.3,
    });

    // 2. Compute new version number
    const { data: latest } = await supabase
      .from('scripts')
      .select('version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (latest?.version ?? 0) + 1;

    // 3. Deactivate old scripts
    await supabase
      .from('scripts')
      .update({ is_active: false })
      .eq('project_id', projectId);

    // 4. Create new script version
    const { data: newScript, error: scriptErr } = await supabase
      .from('scripts')
      .insert({
        project_id: projectId,
        user_id: userId,
        version: nextVersion,
        video_title: translated.video_title.trim(),
        hook: translated.hook.trim(),
        call_to_action: translated.call_to_action.trim(),
        caption_text: translated.caption_text.trim(),
        hashtags: translated.hashtags,
        total_duration_seconds: activeScript.total_duration_seconds,
        advisory_note: `Translated to ${targetLanguage.toUpperCase()}`,
        model: env.GEMINI_TEXT_MODEL,
        is_active: true,
      })
      .select()
      .single();

    if (scriptErr || !newScript) {
      throw new AppError('INTERNAL', 500, 'Failed to persist translated script');
    }

    // 5. Insert translated scenes
    const sceneRows = translated.scenes.map((s, idx) => ({
      script_id: newScript.id,
      project_id: projectId,
      user_id: userId,
      scene_index: idx,
      duration_seconds: s.duration_seconds,
      narration: s.narration.trim(),
      on_screen_text: s.on_screen_text.trim(),
      visual_description: s.visual_description.trim(),
      image_prompt: s.image_prompt.trim(),
      camera_motion: s.camera_motion,
      transition: s.transition,
      mood: s.mood.trim(),
      music_cue: s.music_cue.trim(),
    }));

    const { data: insertedScenes, error: sceneErr } = await supabase
      .from('scenes')
      .insert(sceneRows)
      .select();

    if (sceneErr) {
      throw new AppError('INTERNAL', 500, 'Failed to persist translated scenes');
    }

    // Update project language
    await supabase.from('projects').update({ language: targetLanguage }).eq('id', projectId);

    return { script: newScript, scenes: insertedScenes || [] };
  }

  /**
   * Feature 7: Quality and Fact-Checking Audit
   */
  static async auditQuality(
    projectId: string,
    userId: string,
    supabase: SupabaseClient
  ): Promise<QualityAuditResponse> {
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const { data: script } = await supabase
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    if (!script) throw new AppError('NOT_FOUND', 404, 'Active script not found');

    const { data: scenes } = await supabase
      .from('scenes')
      .select('*')
      .eq('script_id', script.id)
      .order('scene_index', { ascending: true });

    const prompt = buildQualityAuditPrompt({
      source_text: project.source_text,
      script_json: JSON.stringify({ ...script, scenes: scenes || [] }),
    });

    const systemInstruction = `You are ReelForge AI's Chief Fact-Checking Editor and Quality Analyst. You inspect video scripts against source texts with forensic accuracy, evaluating clarity, verifying claims against the source, and providing actionable improvements.`;

    return await generateStructured({
      schema: QualityAuditResponseSchema,
      systemInstruction,
      prompt,
      temperature: 0.2,
    });
  }

  /**
   * Feature 6: Video Content Repurposing Suite
   */
  static async repurposeVideo(
    projectId: string,
    userId: string,
    supabase: SupabaseClient
  ): Promise<RepurposeResponse> {
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const { data: script } = await supabase
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    if (!script) throw new AppError('NOT_FOUND', 404, 'Active script not found');

    const { data: scenes } = await supabase
      .from('scenes')
      .select('*')
      .eq('script_id', script.id)
      .order('scene_index', { ascending: true });

    const prompt = buildRepurposePrompt({
      source_text: project.source_text,
      script_json: JSON.stringify({ ...script, scenes: scenes || [] }),
    });

    const systemInstruction = `You are a viral social media strategist and multi-channel content repurposing expert. You turn educational and long-form video knowledge into high-performing short-form cuts, alternative hooks, and platform-native social copy.`;

    return await generateStructured({
      schema: RepurposeResponseSchema,
      systemInstruction,
      prompt,
      temperature: 0.7,
    });
  }

  /**
   * Feature 4 / Section 4: ReelForge Copilot Assistant
   */
  static async copilotAssist(opts: {
    projectId: string;
    userId: string;
    supabase: SupabaseClient;
    message: string;
    actionType: string;
    sceneIndex?: number;
  }): Promise<CopilotResponse> {
    const { projectId, userId, supabase, message, actionType, sceneIndex } = opts;

    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const { data: script } = await supabase
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    if (!script) throw new AppError('NOT_FOUND', 404, 'Active script not found');

    const { data: scenes } = await supabase
      .from('scenes')
      .select('*')
      .eq('script_id', script.id)
      .order('scene_index', { ascending: true });

    const prompt = buildCopilotPrompt({
      project_context: `Title: ${project.title} | Domain: ${project.domain} | Platform: ${project.target_platform} | Audience: ${project.audience || 'General'}`,
      active_script: JSON.stringify({ ...script, scenes: scenes || [] }),
      user_message: message,
      action_type: actionType,
      scene_index: sceneIndex,
    });

    const systemInstruction = `You are ReelForge AI Copilot, a collaborative creative partner embedded inside the video studio. You offer clear advice, suggest specific edits, and return structured actions when asked to modify scenes, hooks, or styles.`;

    return await generateStructured({
      schema: CopilotResponseSchema,
      systemInstruction,
      prompt,
      temperature: 0.6,
    });
  }
}
