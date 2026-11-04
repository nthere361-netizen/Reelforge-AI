import { SupabaseClient } from '@supabase/supabase-js';
import { synthesizeSpeech, generateImage } from '../lib/gemini.js';
import { assembleImagePrompt, toneDirectiveMap } from '../ai/prompts.js';
import { concatenateWavFiles } from '../lib/wav.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export class MediaService {
  /**
   * Generates or regenerates voiceover audio for a single scene (TTS)
   */
  static async generateSceneAudio(
    sceneId: string,
    userId: string,
    supabase: SupabaseClient
  ): Promise<{ asset: any; warnings: string[] }> {
    const startTime = Date.now();

    // 1. Fetch scene and project
    const { data: scene, error: scErr } = await supabase
      .from('scenes')
      .select('*, projects(*)')
      .eq('id', sceneId)
      .eq('user_id', userId)
      .single();

    if (scErr || !scene) throw new AppError('NOT_FOUND', 404, 'Scene not found');

    const project = scene.projects;
    const projectId = scene.project_id;

    // Normalize narration: trim and expand common symbols
    const narration = scene.narration.replace(/&/g, 'and').replace(/%/g, 'percent').trim();
    if (!narration) throw new AppError('VALIDATION_ERROR', 400, 'Scene narration cannot be empty');

    const toneDirective = toneDirectiveMap[project.tone] || 'Say clearly and steadily';

    let wavData: { wav: Buffer; durationMs: number };
    let logStatus: 'success' | 'api_error' = 'success';
    let errorCode: string | undefined;

    try {
      wavData = await synthesizeSpeech(narration, project.voice_name, toneDirective);
    } catch (err: any) {
      logStatus = 'api_error';
      errorCode = err?.code || 'TTS_FAILED';
      throw err;
    } finally {
      await supabase.from('generation_logs').insert({
        user_id: userId,
        project_id: projectId,
        operation: 'tts',
        model: env.GEMINI_TTS_MODEL,
        status: logStatus,
        latency_ms: Date.now() - startTime,
        error_code: errorCode,
      });
    }

    // 2. Sanity checks (300ms to 60s)
    if (wavData.durationMs < 300 || wavData.durationMs > 60000) {
      throw new AppError('AI_UPSTREAM_ERROR', 502, `Synthesized audio length invalid (${wavData.durationMs}ms)`);
    }

    // 3. Timing reconciliation
    const warnings: string[] = [];
    const currentDurSec = Number(scene.duration_seconds);
    const audioSec = wavData.durationMs / 1000;

    if (audioSec > currentDurSec * 1.2) {
      const adjusted = Math.min(30, Math.ceil(audioSec));
      await supabase.from('scenes').update({ duration_seconds: adjusted }).eq('id', sceneId);
      warnings.push('SCENE_DURATION_ADJUSTED');
    }

    // 4. Delete existing scene audio and storage object
    const { data: existingAssets } = await supabase
      .from('audio_assets')
      .select('id, storage_path')
      .eq('scene_id', sceneId)
      .eq('kind', 'scene');

    if (existingAssets && existingAssets.length > 0) {
      for (const old of existingAssets) {
        await supabaseAdmin.storage.from('project-audio').remove([old.storage_path]);
        await supabase.from('audio_assets').delete().eq('id', old.id);
      }
    }

    // 5. Upload new WAV to project-audio/<user_id>/<project_id>/scene-<scene_id>-<timestamp>.wav
    const timestamp = Date.now();
    const storagePath = `${userId}/${projectId}/scene-${sceneId}-${timestamp}.wav`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('project-audio')
      .upload(storagePath, wavData.wav, {
        contentType: 'audio/wav',
        upsert: true,
      });

    if (uploadErr) {
      logger.error({ uploadErr }, 'Failed to upload audio to Supabase Storage');
      throw new AppError('INTERNAL', 500, 'Failed to store voiceover audio');
    }

    // 6. Insert audio_assets row
    const { data: asset, error: insErr } = await supabase
      .from('audio_assets')
      .insert({
        project_id: projectId,
        scene_id: sceneId,
        user_id: userId,
        kind: 'scene',
        storage_path: storagePath,
        voice_name: project.voice_name,
        duration_ms: wavData.durationMs,
        mime_type: 'audio/wav',
      })
      .select()
      .single();

    if (insErr || !asset) {
      throw new AppError('INTERNAL', 500, 'Failed to save audio asset record');
    }

    return { asset, warnings };
  }

  /**
   * Generates or regenerates storyboard image for a single scene
   */
  static async generateSceneImage(
    sceneId: string,
    userId: string,
    supabase: SupabaseClient
  ): Promise<{ asset: any }> {
    const startTime = Date.now();

    // 1. Fetch scene and project
    const { data: scene, error: scErr } = await supabase
      .from('scenes')
      .select('*, projects(*)')
      .eq('id', sceneId)
      .eq('user_id', userId)
      .single();

    if (scErr || !scene) throw new AppError('NOT_FOUND', 404, 'Scene not found');

    const project = scene.projects;
    const projectId = scene.project_id;

    // Assemble prompt (never include narration or on_screen_text)
    const assembledPrompt = assembleImagePrompt({
      scene_image_prompt: scene.image_prompt,
      visual_style: project.visual_style,
      aspect_ratio: project.aspect_ratio,
    });

    let imgData: { bytes: Buffer; mimeType: string };
    let logStatus: 'success' | 'api_error' = 'success';
    let errorCode: string | undefined;

    try {
      imgData = await generateImage(assembledPrompt, project.aspect_ratio);
    } catch (err: any) {
      logStatus = 'api_error';
      errorCode = err?.code || 'IMAGE_GEN_FAILED';
      throw err;
    } finally {
      await supabase.from('generation_logs').insert({
        user_id: userId,
        project_id: projectId,
        operation: 'image',
        model: env.GEMINI_IMAGE_MODEL,
        status: logStatus,
        latency_ms: Date.now() - startTime,
        error_code: errorCode,
      });
    }

    // 2. Delete existing image asset & storage object
    const { data: existingImages } = await supabase
      .from('image_assets')
      .select('id, storage_path')
      .eq('scene_id', sceneId);

    if (existingImages && existingImages.length > 0) {
      for (const old of existingImages) {
        await supabaseAdmin.storage.from('project-images').remove([old.storage_path]);
        await supabase.from('image_assets').delete().eq('id', old.id);
      }
    }

    // 3. Upload image
    const timestamp = Date.now();
    const ext = imgData.mimeType.includes('jpeg') ? 'jpg' : 'png';
    const storagePath = `${userId}/${projectId}/scene-${sceneId}-${timestamp}.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('project-images')
      .upload(storagePath, imgData.bytes, {
        contentType: imgData.mimeType,
        upsert: true,
      });

    if (uploadErr) {
      logger.error({ uploadErr }, 'Failed to upload image to Supabase Storage');
      throw new AppError('INTERNAL', 500, 'Failed to store storyboard image');
    }

    // 4. Insert image_assets row
    const { data: asset, error: insErr } = await supabase
      .from('image_assets')
      .insert({
        project_id: projectId,
        scene_id: sceneId,
        user_id: userId,
        storage_path: storagePath,
        prompt_used: assembledPrompt,
        aspect_ratio: project.aspect_ratio,
        mime_type: imgData.mimeType,
      })
      .select()
      .single();

    if (insErr || !asset) {
      throw new AppError('INTERNAL', 500, 'Failed to save image asset record');
    }

    return { asset };
  }

  /**
   * Generates all missing audio and images with bounded concurrency
   */
  static async generateAllMedia(
    projectId: string,
    userId: string,
    supabase: SupabaseClient,
    force = false
  ): Promise<{
    totalScenes: number;
    audioResults: Array<{ sceneId: string; status: 'success' | 'failed' | 'skipped'; error?: string }>;
    imageResults: Array<{ sceneId: string; status: 'success' | 'failed' | 'skipped'; error?: string }>;
    ready: boolean;
  }> {
    // 1. Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    // 2. Fetch active script and scenes
    const { data: activeScript, error: scErr } = await supabase
      .from('scripts')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (scErr || !activeScript) {
      throw new AppError('NOT_FOUND', 404, 'Active script not found');
    }

    const { data: scenes } = await supabase
      .from('scenes')
      .select('id, scene_index')
      .eq('script_id', activeScript.id)
      .order('scene_index', { ascending: true });

    if (!scenes || scenes.length === 0) {
      throw new AppError('VALIDATION_ERROR', 400, 'Project has no scenes');
    }

    // Set project status to media_generating
    await supabase.from('projects').update({ status: 'media_generating' }).eq('id', projectId);

    const { data: existingAudio } = await supabase
      .from('audio_assets')
      .select('scene_id')
      .eq('project_id', projectId)
      .eq('kind', 'scene');

    const { data: existingImages } = await supabase
      .from('image_assets')
      .select('scene_id')
      .eq('project_id', projectId);

    const audioSceneSet = new Set(existingAudio?.map((a) => a.scene_id));
    const imageSceneSet = new Set(existingImages?.map((i) => i.scene_id));

    const audioResults: Array<{ sceneId: string; status: 'success' | 'failed' | 'skipped'; error?: string }> = [];
    const imageResults: Array<{ sceneId: string; status: 'success' | 'failed' | 'skipped'; error?: string }> = [];

    // Bounded concurrency helper: parallel audio & image generation
    const concurrency = env.MEDIA_CONCURRENCY || 4;

    // Concurrently process scenes: for each scene, generate Audio and Image in parallel
    for (let i = 0; i < scenes.length; i += concurrency) {
      const batch = scenes.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (sc) => {
          // Parallel execution for Scene Audio & Image
          const audioPromise = (async () => {
            if (!force && audioSceneSet.has(sc.id)) {
              audioResults.push({ sceneId: sc.id, status: 'skipped' });
              return;
            }
            try {
              await this.generateSceneAudio(sc.id, userId, supabase);
              audioResults.push({ sceneId: sc.id, status: 'success' });
            } catch (err: any) {
              audioResults.push({ sceneId: sc.id, status: 'failed', error: err.message });
            }
          })();

          const imagePromise = (async () => {
            if (!force && imageSceneSet.has(sc.id)) {
              imageResults.push({ sceneId: sc.id, status: 'skipped' });
              return;
            }
            try {
              await this.generateSceneImage(sc.id, userId, supabase);
              imageResults.push({ sceneId: sc.id, status: 'success' });
            } catch (err: any) {
              imageResults.push({ sceneId: sc.id, status: 'failed', error: err.message });
            }
          })();

          await Promise.allSettled([audioPromise, imagePromise]);
        })
      );
    }

    // Check if every scene now has both audio and image
    const { count: finalAudioCount } = await supabase
      .from('audio_assets')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('kind', 'scene');

    const { count: finalImageCount } = await supabase
      .from('image_assets')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const isAllReady = (finalAudioCount ?? 0) >= scenes.length && (finalImageCount ?? 0) >= scenes.length;

    if (isAllReady) {
      await supabase.from('projects').update({ status: 'ready' }).eq('id', projectId);
    }

    return {
      totalScenes: scenes.length,
      audioResults,
      imageResults,
      ready: isAllReady,
    };
  }

  /**
   * Concatenates all scene WAV files with 250ms silence into a full track
   */
  static async concatenateFullTrack(
    projectId: string,
    userId: string,
    supabase: SupabaseClient
  ): Promise<any> {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    // 1. Fetch active script scenes in index order
    const { data: activeScript } = await supabase
      .from('scripts')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!activeScript) throw new AppError('NOT_FOUND', 404, 'Active script not found');

    const { data: scenes } = await supabase
      .from('scenes')
      .select('id, scene_index')
      .eq('script_id', activeScript.id)
      .order('scene_index', { ascending: true });

    if (!scenes || scenes.length === 0) throw new AppError('VALIDATION_ERROR', 400, 'No scenes found');

    const { data: audioAssets } = await supabase
      .from('audio_assets')
      .select('*')
      .eq('project_id', projectId)
      .eq('kind', 'scene');

    const audioByScene = new Map(audioAssets?.map((a) => [a.scene_id, a]));

    const missing = scenes.filter((s) => !audioByScene.has(s.id));
    if (missing.length > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        `Cannot concatenate full track: missing audio for scenes ${missing.map((s) => s.scene_index).join(', ')}`
      );
    }

    // 2. Download each WAV buffer in scene order
    const wavBuffers: Buffer[] = [];
    for (const sc of scenes) {
      const asset = audioByScene.get(sc.id)!;
      const { data, error } = await supabaseAdmin.storage
        .from('project-audio')
        .download(asset.storage_path);
      if (error || !data) {
        throw new AppError('INTERNAL', 500, `Failed to download audio for scene ${sc.scene_index}`);
      }
      wavBuffers.push(Buffer.from(await data.arrayBuffer()));
    }

    // 3. Concatenate with 250ms silence
    const { buffer: fullWav, durationMs } = concatenateWavFiles(wavBuffers, 250, 24000);

    // 4. Remove previous full_track
    const { data: oldFullTrack } = await supabase
      .from('audio_assets')
      .select('id, storage_path')
      .eq('project_id', projectId)
      .eq('kind', 'full_track');

    if (oldFullTrack && oldFullTrack.length > 0) {
      for (const old of oldFullTrack) {
        await supabaseAdmin.storage.from('project-audio').remove([old.storage_path]);
        await supabase.from('audio_assets').delete().eq('id', old.id);
      }
    }

    // 5. Upload new full track
    const storagePath = `${userId}/${projectId}/full-track-${Date.now()}.wav`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('project-audio')
      .upload(storagePath, fullWav, { contentType: 'audio/wav', upsert: true });

    if (upErr) throw new AppError('INTERNAL', 500, 'Failed to upload full track audio');

    const { data: fullTrackAsset, error: insErr } = await supabase
      .from('audio_assets')
      .insert({
        project_id: projectId,
        user_id: userId,
        kind: 'full_track',
        storage_path: storagePath,
        voice_name: audioAssets?.[0]?.voice_name || 'Kore',
        duration_ms: durationMs,
        mime_type: 'audio/wav',
      })
      .select()
      .single();

    if (insErr) throw new AppError('INTERNAL', 500, 'Failed to save full track asset row');

    return fullTrackAsset;
  }

  /**
   * Generates 1-hour signed URLs for all media assets belonging to a project
   */
  static async getMediaSignedUrls(
    projectId: string,
    userId: string,
    supabase: SupabaseClient
  ): Promise<{
    audio: Record<string, string>;
    fullTrackUrl?: string;
    images: Record<string, string>;
  }> {
    // Ownership check via user client
    const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const ttl = env.SIGNED_URL_TTL_SECONDS || 3600;

    const { data: audioList } = await supabase.from('audio_assets').select('*').eq('project_id', projectId);
    const { data: imageList } = await supabase.from('image_assets').select('*').eq('project_id', projectId);

    const audioUrls: Record<string, string> = {};
    let fullTrackUrl: string | undefined;

    if (audioList) {
      for (const a of audioList) {
        const { data } = await supabaseAdmin.storage
          .from('project-audio')
          .createSignedUrl(a.storage_path, ttl);
        if (data?.signedUrl) {
          if (a.kind === 'full_track') {
            fullTrackUrl = data.signedUrl;
          } else if (a.scene_id) {
            audioUrls[a.scene_id] = data.signedUrl;
          }
        }
      }
    }

    const imageUrls: Record<string, string> = {};
    if (imageList) {
      for (const img of imageList) {
        const { data } = await supabaseAdmin.storage
          .from('project-images')
          .createSignedUrl(img.storage_path, ttl);
        if (data?.signedUrl) {
          imageUrls[img.scene_id] = data.signedUrl;
        }
      }
    }

    return {
      audio: audioUrls,
      fullTrackUrl,
      images: imageUrls,
    };
  }
}
