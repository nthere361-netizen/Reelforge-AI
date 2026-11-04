import { SupabaseClient } from '@supabase/supabase-js';
import {
  CreateProjectRequest,
  UpdateProjectRequest,
  SceneEdit,
  AddScene,
} from '@reelforge/shared';
import { SourceService } from './sourceService.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';

export class ProjectService {
  static async listProjects(
    _userId: string,
    query: { q?: string; status?: string; domain?: string; page?: number; limit?: number },
    supabase: SupabaseClient
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    let q = supabase
      .from('projects')
      .select('*, scripts(id, total_duration_seconds, is_active)', { count: 'exact' });

    if (query.q) {
      q = q.ilike('title', `%${query.q}%`);
    }
    if (query.status) {
      q = q.eq('status', query.status);
    }
    if (query.domain) {
      q = q.eq('domain', query.domain);
    }

    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) throw new AppError('INTERNAL', 500, 'Failed to fetch projects');

    return {
      projects: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  static async createProject(
    userId: string,
    body: CreateProjectRequest,
    supabase: SupabaseClient
  ) {
    const { text, wordCount } = SourceService.normalizeText(body.source_text);

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        title: body.title,
        source_type: body.source_type,
        source_url: body.source_url,
        source_filename: body.source_filename,
        source_text: text,
        source_word_count: wordCount,
        domain: body.domain,
        target_platform: body.target_platform,
        aspect_ratio: body.aspect_ratio,
        target_duration_seconds: body.target_duration_seconds,
        tone: body.tone,
        language: body.language,
        audience: body.audience,
        voice_name: body.voice_name,
        visual_style: body.visual_style,
        include_cta: body.include_cta,
        extra_instructions: body.extra_instructions,
        status: 'draft',
      })
      .select()
      .single();

    if (error || !project) {
      throw new AppError('INTERNAL', 500, `Failed to create project: ${error?.message}`);
    }

    return project;
  }

  static async getProject(projectId: string, userId: string, supabase: SupabaseClient) {
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projErr || !project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const { data: analysis } = await supabase
      .from('content_analyses')
      .select('*')
      .eq('project_id', projectId)
      .single();

    const { data: activeScript } = await supabase
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .single();

    let scenes: any[] = [];
    if (activeScript) {
      const { data: sceneList } = await supabase
        .from('scenes')
        .select('*')
        .eq('script_id', activeScript.id)
        .order('scene_index', { ascending: true });
      scenes = sceneList || [];
    }

    const { data: audioAssets } = await supabase
      .from('audio_assets')
      .select('id, scene_id, kind, duration_ms, voice_name')
      .eq('project_id', projectId);

    const { data: imageAssets } = await supabase
      .from('image_assets')
      .select('id, scene_id, aspect_ratio')
      .eq('project_id', projectId);

    return {
      ...project,
      analysis: analysis || null,
      active_script: activeScript || null,
      scenes,
      assets: {
        audio: audioAssets || [],
        images: imageAssets || [],
      },
    };
  }

  static async updateProject(
    projectId: string,
    userId: string,
    body: UpdateProjectRequest,
    supabase: SupabaseClient
  ) {
    const { data: project, error } = await supabase
      .from('projects')
      .update(body)
      .eq('id', projectId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    return project;
  }

  static async duplicateProject(projectId: string, userId: string, supabase: SupabaseClient) {
    const current = await this.getProject(projectId, userId, supabase);

    const { data: newProj, error: pErr } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        title: `${current.title} (Copy)`.slice(0, 120),
        source_type: current.source_type,
        source_url: current.source_url,
        source_filename: current.source_filename,
        source_text: current.source_text,
        source_word_count: current.source_word_count,
        domain: current.domain,
        target_platform: current.target_platform,
        aspect_ratio: current.aspect_ratio,
        target_duration_seconds: current.target_duration_seconds,
        tone: current.tone,
        language: current.language,
        audience: current.audience,
        voice_name: current.voice_name,
        visual_style: current.visual_style,
        include_cta: current.include_cta,
        extra_instructions: current.extra_instructions,
        status: current.active_script ? 'scripted' : 'draft',
      })
      .select()
      .single();

    if (pErr || !newProj) {
      throw new AppError('INTERNAL', 500, 'Failed to duplicate project');
    }

    // Duplicate analysis if present
    if (current.analysis) {
      await supabase.from('content_analyses').insert({
        project_id: newProj.id,
        user_id: userId,
        suggested_title: current.analysis.suggested_title,
        summary: current.analysis.summary,
        key_points: current.analysis.key_points,
        detected_topic: current.analysis.detected_topic,
        audience_insights: current.analysis.audience_insights,
        recommended_structure: current.analysis.recommended_structure,
        model: current.analysis.model,
      });
    }

    // Duplicate active script and scenes if present
    if (current.active_script) {
      const { data: newScript } = await supabase
        .from('scripts')
        .insert({
          project_id: newProj.id,
          user_id: userId,
          version: 1,
          video_title: current.active_script.video_title,
          hook: current.active_script.hook,
          call_to_action: current.active_script.call_to_action,
          caption_text: current.active_script.caption_text,
          hashtags: current.active_script.hashtags,
          total_duration_seconds: current.active_script.total_duration_seconds,
          advisory_note: current.active_script.advisory_note,
          model: current.active_script.model,
          is_active: true,
        })
        .select()
        .single();

      if (newScript && current.scenes.length > 0) {
        const scenesCopy = current.scenes.map((s: any) => ({
          script_id: newScript.id,
          project_id: newProj.id,
          user_id: userId,
          scene_index: s.scene_index,
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
        await supabase.from('scenes').insert(scenesCopy);
      }
    }

    return newProj;
  }

  static async deleteProject(projectId: string, userId: string, supabase: SupabaseClient) {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    // Remove storage folder for project
    try {
      const audioFiles = await supabaseAdmin.storage.from('project-audio').list(`${userId}/${projectId}`);
      if (audioFiles.data && audioFiles.data.length > 0) {
        await supabaseAdmin.storage
          .from('project-audio')
          .remove(audioFiles.data.map((f) => `${userId}/${projectId}/${f.name}`));
      }

      const imgFiles = await supabaseAdmin.storage.from('project-images').list(`${userId}/${projectId}`);
      if (imgFiles.data && imgFiles.data.length > 0) {
        await supabaseAdmin.storage
          .from('project-images')
          .remove(imgFiles.data.map((f) => `${userId}/${projectId}/${f.name}`));
      }
    } catch {
      // Continue project deletion
    }

    const { error } = await supabase.from('projects').delete().eq('id', projectId).eq('user_id', userId);
    if (error) throw new AppError('INTERNAL', 500, 'Failed to delete project');

    return { success: true };
  }

  // --- Scenes Management ---

  static async editScene(
    sceneId: string,
    userId: string,
    body: SceneEdit,
    supabase: SupabaseClient
  ) {
    const { data: updated, error } = await supabase
      .from('scenes')
      .update(body)
      .eq('id', sceneId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !updated) {
      throw new AppError('NOT_FOUND', 404, 'Scene not found');
    }

    return updated;
  }

  static async addScene(
    projectId: string,
    userId: string,
    body: AddScene,
    supabase: SupabaseClient
  ) {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const { data: script } = await supabase
      .from('scripts')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!script) throw new AppError('NOT_FOUND', 404, 'Active script not found');

    const { data: existingScenes } = await supabase
      .from('scenes')
      .select('id, scene_index')
      .eq('script_id', script.id)
      .eq('user_id', userId)
      .order('scene_index', { ascending: true });

    const scenes = existingScenes || [];
    const insertAfter = body.insert_after_index ?? scenes.length - 1;
    const newIndex = insertAfter + 1;

    // Shift subsequent scenes up by 1
    for (let i = scenes.length - 1; i >= newIndex; i--) {
      await supabase
        .from('scenes')
        .update({ scene_index: i + 1 })
        .eq('id', scenes[i].id)
        .eq('user_id', userId);
    }

    const { data: newScene, error } = await supabase
      .from('scenes')
      .insert({
        script_id: script.id,
        project_id: projectId,
        user_id: userId,
        scene_index: newIndex,
        duration_seconds: body.duration_seconds,
        narration: body.narration,
        on_screen_text: body.on_screen_text,
        visual_description: body.visual_description,
        image_prompt: body.image_prompt,
        camera_motion: body.camera_motion,
        transition: body.transition,
        mood: body.mood,
        music_cue: body.music_cue,
      })
      .select()
      .single();

    if (error || !newScene) throw new AppError('INTERNAL', 500, 'Failed to add scene');

    return newScene;
  }

  static async deleteScene(sceneId: string, userId: string, supabase: SupabaseClient) {
    const { data: scene } = await supabase
      .from('scenes')
      .select('*')
      .eq('id', sceneId)
      .eq('user_id', userId)
      .single();
    if (!scene) throw new AppError('NOT_FOUND', 404, 'Scene not found');

    const deletedIndex = scene.scene_index;
    const scriptId = scene.script_id;

    // Delete scene
    await supabase.from('scenes').delete().eq('id', sceneId).eq('user_id', userId);

    // Re-index remaining scenes
    const { data: remaining } = await supabase
      .from('scenes')
      .select('id, scene_index')
      .eq('script_id', scriptId)
      .eq('user_id', userId)
      .gt('scene_index', deletedIndex)
      .order('scene_index', { ascending: true });

    if (remaining) {
      for (const sc of remaining) {
        await supabase
          .from('scenes')
          .update({ scene_index: sc.scene_index - 1 })
          .eq('id', sc.id)
          .eq('user_id', userId);
      }
    }

    return { success: true };
  }

  static async reorderScenes(
    projectId: string,
    userId: string,
    orderedSceneIds: string[],
    supabase: SupabaseClient
  ) {
    const { data: script } = await supabase
      .from('scripts')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!script) throw new AppError('NOT_FOUND', 404, 'Active script not found');

    // First assign temporary negative index to avoid unique constraint violations
    for (let i = 0; i < orderedSceneIds.length; i++) {
      await supabase
        .from('scenes')
        .update({ scene_index: -(i + 1) })
        .eq('id', orderedSceneIds[i])
        .eq('script_id', script.id)
        .eq('user_id', userId);
    }

    // Now set sequential 0-based index
    for (let i = 0; i < orderedSceneIds.length; i++) {
      await supabase
        .from('scenes')
        .update({ scene_index: i })
        .eq('id', orderedSceneIds[i])
        .eq('script_id', script.id)
        .eq('user_id', userId);
    }

    const { data: updated } = await supabase
      .from('scenes')
      .select('*')
      .eq('script_id', script.id)
      .eq('user_id', userId)
      .order('scene_index', { ascending: true });

    return updated || [];
  }

  // --- Script Versions ---

  static async listScriptVersions(projectId: string, userId: string, supabase: SupabaseClient) {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const { data: versions, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('version', { ascending: false });

    if (error) throw new AppError('INTERNAL', 500, 'Failed to fetch script versions');
    return versions || [];
  }

  static async activateScriptVersion(
    projectId: string,
    scriptId: string,
    userId: string,
    supabase: SupabaseClient
  ) {
    const { data: script } = await supabase
      .from('scripts')
      .select('*')
      .eq('id', scriptId)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (!script) throw new AppError('NOT_FOUND', 404, 'Script version not found');

    // Deactivate all
    await supabase.from('scripts').update({ is_active: false }).eq('project_id', projectId).eq('user_id', userId);

    // Activate selected
    const { data: activated, error } = await supabase
      .from('scripts')
      .update({ is_active: true })
      .eq('id', scriptId)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new AppError('INTERNAL', 500, 'Failed to activate script version');
    return activated;
  }
}
