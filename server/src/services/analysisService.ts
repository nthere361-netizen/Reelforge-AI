import { SupabaseClient } from '@supabase/supabase-js';
import { AnalysisOutput, AnalysisOutputSchema } from '@reelforge/shared';
import { generateStructured } from '../lib/gemini.js';
import { buildSystemPrompt } from '../ai/systemPrompt.js';
import { buildAnalysisPrompt } from '../ai/prompts.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export class AnalysisService {
  static async analyzeProject(
    projectId: string,
    userId: string,
    supabase: SupabaseClient
  ): Promise<AnalysisOutput> {
    const startTime = Date.now();

    // 1. Fetch project details
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projError || !project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    // 2. Build system and user prompts
    const systemInstruction = buildSystemPrompt({
      domain: project.domain,
      tone: project.tone,
      audience: project.audience,
      platform: project.target_platform,
      aspect_ratio: project.aspect_ratio,
      visual_style: project.visual_style,
    });

    const prompt = buildAnalysisPrompt({
      target_duration_seconds: project.target_duration_seconds,
      platform: project.target_platform,
      language: project.language,
      extra_instructions: project.extra_instructions,
      source_text: project.source_text,
    });

    let analysis: AnalysisOutput;
    let logStatus: 'success' | 'validation_failed' | 'api_error' = 'success';
    let errorCode: string | undefined;

    try {
      analysis = await generateStructured({
        schema: AnalysisOutputSchema,
        systemInstruction,
        prompt,
      });
    } catch (err: any) {
      logStatus = err?.code === 'AI_OUTPUT_INVALID' ? 'validation_failed' : 'api_error';
      errorCode = err?.code || 'UNKNOWN';
      throw err;
    } finally {
      const latencyMs = Date.now() - startTime;
      // Log generation metadata only (never prompt or source)
      await supabase.from('generation_logs').insert({
        user_id: userId,
        project_id: projectId,
        operation: 'analyze',
        model: env.GEMINI_TEXT_MODEL,
        status: logStatus,
        latency_ms: latencyMs,
        error_code: errorCode,
      });
    }

    // 3. Upsert analysis row
    const { error: upsertError } = await supabase.from('content_analyses').upsert(
      {
        project_id: projectId,
        user_id: userId,
        suggested_title: analysis.suggested_title,
        summary: analysis.summary,
        detected_topic: analysis.detected_topic,
        key_points: analysis.key_points,
        audience_insights: analysis.audience_insights,
        recommended_structure: analysis.recommended_structure,
        model: env.GEMINI_TEXT_MODEL,
      },
      { onConflict: 'project_id' }
    );

    if (upsertError) {
      logger.error({ upsertError }, 'Failed to persist content analysis');
      throw new AppError('INTERNAL', 500, 'Failed to save analysis results');
    }

    return analysis;
  }
}
