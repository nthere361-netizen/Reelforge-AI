import { SupabaseClient } from '@supabase/supabase-js';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import { PassThrough, Readable } from 'stream';
import { MediaService } from './mediaService.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';

export interface CaptionCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export function formatTimestamp(ms: number, format: 'srt' | 'vtt'): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');

  return format === 'srt' ? `${hh}:${mm}:${ss},${mmm}` : `${hh}:${mm}:${ss}.${mmm}`;
}

export function generateCaptionCues(scenes: any[], audioAssets?: any[]): CaptionCue[] {
  const audioDurationMap = new Map<string, number>();
  if (audioAssets) {
    audioAssets.forEach((a) => {
      if (a.kind === 'scene' && a.scene_id && a.duration_ms) {
        audioDurationMap.set(a.scene_id, a.duration_ms);
      }
    });
  }

  const cues: CaptionCue[] = [];
  let currentStartMs = 0;
  let cueIndex = 1;

  for (const sc of scenes) {
    const sceneDurMs = audioDurationMap.get(sc.id) ?? Math.round(Number(sc.duration_seconds) * 1000);
    const words = sc.narration.split(/\s+/).filter(Boolean);

    // Split words into chunks of at most 8 words
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 8) {
      chunks.push(words.slice(i, i + 8).join(' '));
    }

    if (chunks.length === 0) {
      chunks.push(sc.narration);
    }

    const chunkDurationMs = sceneDurMs / chunks.length;

    for (let c = 0; c < chunks.length; c++) {
      const start = Math.round(currentStartMs + c * chunkDurationMs);
      const end = Math.round(currentStartMs + (c + 1) * chunkDurationMs);
      cues.push({
        index: cueIndex++,
        startMs: start,
        endMs: end,
        text: chunks[c],
      });
    }

    currentStartMs += sceneDurMs;
  }

  return cues;
}

export class ExportService {
  /**
   * Generates JSON export package
   */
  static async exportJson(projectId: string, userId: string, supabase: SupabaseClient) {
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const { data: analysis } = await supabase.from('content_analyses').select('*').eq('project_id', projectId).single();
    const { data: script } = await supabase.from('scripts').select('*').eq('project_id', projectId).eq('is_active', true).single();

    let scenes: any[] = [];
    if (script) {
      const { data: sceneList } = await supabase.from('scenes').select('*').eq('script_id', script.id).order('scene_index', { ascending: true });
      scenes = sceneList || [];
    }

    // Strip sensitive IDs and storage paths
    const cleanProject = {
      title: project.title,
      domain: project.domain,
      target_platform: project.target_platform,
      aspect_ratio: project.aspect_ratio,
      target_duration_seconds: project.target_duration_seconds,
      tone: project.tone,
      language: project.language,
      voice_name: project.voice_name,
      visual_style: project.visual_style,
      include_cta: project.include_cta,
      source_word_count: project.source_word_count,
    };

    const cleanAnalysis = analysis
      ? {
          suggested_title: analysis.suggested_title,
          summary: analysis.summary,
          key_points: analysis.key_points,
          detected_topic: analysis.detected_topic,
          audience_insights: analysis.audience_insights,
          recommended_structure: analysis.recommended_structure,
        }
      : null;

    const cleanScript = script
      ? {
          version: script.version,
          video_title: script.video_title,
          hook: script.hook,
          call_to_action: script.call_to_action,
          caption_text: script.caption_text,
          hashtags: script.hashtags,
          total_duration_seconds: script.total_duration_seconds,
          advisory_note: script.advisory_note,
        }
      : null;

    const cleanScenes = scenes.map((s) => ({
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

    await supabase.from('exports').insert({
      project_id: projectId,
      user_id: userId,
      kind: 'json',
    });

    return {
      schema_version: 1,
      project: cleanProject,
      analysis: cleanAnalysis,
      script: cleanScript,
      scenes: cleanScenes,
      exported_at: new Date().toISOString(),
    };
  }

  /**
   * Generates SRT captions formatted according to spec
   */
  static async exportSrt(projectId: string, userId: string, supabase: SupabaseClient): Promise<string> {
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

    const { data: scenes } = await supabase.from('scenes').select('*').eq('script_id', script.id).order('scene_index', { ascending: true });
    const { data: audioList } = await supabase.from('audio_assets').select('*').eq('project_id', projectId);

    const cues = generateCaptionCues(scenes || [], audioList || []);

    const srtText = cues
      .map((cue) => {
        const start = formatTimestamp(cue.startMs, 'srt');
        const end = formatTimestamp(cue.endMs, 'srt');
        return `${cue.index}\r\n${start} --> ${end}\r\n${cue.text}\r\n`;
      })
      .join('\r\n');

    await supabase.from('exports').insert({ project_id: projectId, user_id: userId, kind: 'srt' });
    return srtText;
  }

  /**
   * Generates VTT captions formatted according to spec
   */
  static async exportVtt(projectId: string, userId: string, supabase: SupabaseClient): Promise<string> {
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

    const { data: scenes } = await supabase.from('scenes').select('*').eq('script_id', script.id).order('scene_index', { ascending: true });
    const { data: audioList } = await supabase.from('audio_assets').select('*').eq('project_id', projectId);

    const cues = generateCaptionCues(scenes || [], audioList || []);

    const vttBody = cues
      .map((cue) => {
        const start = formatTimestamp(cue.startMs, 'vtt');
        const end = formatTimestamp(cue.endMs, 'vtt');
        return `${cue.index}\n${start} --> ${end}\n${cue.text}\n`;
      })
      .join('\n');

    await supabase.from('exports').insert({ project_id: projectId, user_id: userId, kind: 'vtt' });
    return `WEBVTT\n\n${vttBody}`;
  }

  /**
   * Returns full voiceover WAV buffer
   */
  static async exportAudioWav(projectId: string, userId: string, supabase: SupabaseClient): Promise<Buffer> {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const { data: existingFull } = await supabase
      .from('audio_assets')
      .select('storage_path')
      .eq('project_id', projectId)
      .eq('kind', 'full_track')
      .single();

    let storagePath = existingFull?.storage_path;

    if (!storagePath) {
      // Concatenate on demand
      const created = await MediaService.concatenateFullTrack(projectId, userId, supabase);
      storagePath = created.storage_path;
    }

    const { data, error } = await supabaseAdmin.storage.from('project-audio').download(storagePath);
    if (error || !data) {
      throw new AppError('INTERNAL', 500, 'Failed to download full track audio for export');
    }

    await supabase.from('exports').insert({ project_id: projectId, user_id: userId, kind: 'audio_wav' });
    return Buffer.from(await data.arrayBuffer());
  }

  /**
   * Generates a ZIP archive containing all scene images + prompts.txt
   */
  static async exportImagesZip(projectId: string, userId: string, supabase: SupabaseClient): Promise<Readable> {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const { data: activeScript } = await supabase
      .from('scripts')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    if (!activeScript) throw new AppError('NOT_FOUND', 404, 'Active script not found');

    const { data: scenes } = await supabase.from('scenes').select('*').eq('script_id', activeScript.id).order('scene_index', { ascending: true });
    const { data: images } = await supabase.from('image_assets').select('*').eq('project_id', projectId);

    const imageMap = new Map(images?.map((img) => [img.scene_id, img]));

    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = new PassThrough();
    archive.pipe(stream);

    let promptsText = `ReelForge AI — Scene Image Prompts\nGenerated: ${new Date().toISOString()}\n\n`;

    if (scenes) {
      for (const sc of scenes) {
        const num = String(sc.scene_index + 1).padStart(2, '0');
        promptsText += `--- Scene ${num} ---\n`;
        promptsText += `Prompt: ${sc.image_prompt}\n`;
        promptsText += `Visual Description: ${sc.visual_description}\n`;
        promptsText += `Motion: ${sc.camera_motion} | Transition: ${sc.transition}\n\n`;

        const imgAsset = imageMap.get(sc.id);
        if (imgAsset) {
          const { data } = await supabaseAdmin.storage.from('project-images').download(imgAsset.storage_path);
          if (data) {
            const ext = imgAsset.mime_type.includes('jpeg') ? 'jpg' : 'png';
            const buf = Buffer.from(await data.arrayBuffer());
            archive.append(buf, { name: `${num}-scene.${ext}` });
          }
        }
      }
    }

    archive.append(promptsText, { name: 'prompts.txt' });
    archive.finalize();

    await supabase.from('exports').insert({ project_id: projectId, user_id: userId, kind: 'images_zip' });
    return stream;
  }

  /**
   * Generates a printable PDF storyboard in A4 landscape
   */
  static async exportStoryboardPdf(projectId: string, userId: string, supabase: SupabaseClient): Promise<Buffer> {
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

    const { data: scenes } = await supabase.from('scenes').select('*').eq('script_id', script.id).order('scene_index', { ascending: true });
    const { data: images } = await supabase.from('image_assets').select('*').eq('project_id', projectId);

    const imageMap = new Map(images?.map((i) => [i.scene_id, i]));

    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', async () => {
        await supabase.from('exports').insert({ project_id: projectId, user_id: userId, kind: 'storyboard_pdf' });
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', (err) => reject(err));

      // Title Page
      doc.fontSize(24).font('Helvetica-Bold').text('ReelForge AI — Video Storyboard', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(16).font('Helvetica').text(script.video_title, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#64748b').text(`Domain: ${project.domain.toUpperCase()} | Platform: ${project.target_platform} (${project.aspect_ratio})`, { align: 'center' });
      doc.moveDown(1.5);

      doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('Opening Hook:');
      doc.fontSize(11).font('Helvetica').text(`"${script.hook}"`);
      doc.moveDown(1);

      if (script.call_to_action) {
        doc.fontSize(12).font('Helvetica-Bold').text('Call To Action:');
        doc.fontSize(11).font('Helvetica').text(script.call_to_action);
        doc.moveDown(1);
      }

      if (script.advisory_note) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#b45309').text('Domain Advisory Note:');
        doc.fontSize(10).font('Helvetica').text(script.advisory_note);
        doc.moveDown(1);
      }

      if (script.hashtags && script.hashtags.length > 0) {
        doc.fillColor('#0284c7').fontSize(10).text(script.hashtags.map((h: string) => `#${h}`).join(' '));
      }

      // Per-scene pages
      if (scenes) {
        for (const sc of scenes) {
          doc.addPage();

          doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold').text(`Scene ${sc.scene_index + 1} of ${scenes.length}`);
          doc.fontSize(10).fillColor('#64748b').text(`Duration: ${sc.duration_seconds}s | Motion: ${sc.camera_motion} | Transition: ${sc.transition}`);
          doc.moveDown(1);

          // Left column: Image
          const imgAsset = imageMap.get(sc.id);
          let loadedImage = false;
          if (imgAsset) {
            try {
              const { data } = await supabaseAdmin.storage.from('project-images').download(imgAsset.storage_path);
              if (data) {
                const imgBuf = Buffer.from(await data.arrayBuffer());
                doc.image(imgBuf, 40, 100, { width: 340, height: 380, fit: [340, 380] });
                loadedImage = true;
              }
            } catch {
              loadedImage = false;
            }
          }

          if (!loadedImage) {
            doc.rect(40, 100, 340, 380).fill('#f1f5f9');
            doc.fillColor('#94a3b8').fontSize(12).text('Image Pending / Not Generated', 100, 270);
          }

          // Right column: Narration, On-screen text, Visual Prompt
          const rightColX = 410;
          let currentY = 100;

          doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold').text('Narration (Voiceover):', rightColX, currentY);
          currentY += 18;
          doc.fontSize(10).font('Helvetica').text(`"${sc.narration}"`, rightColX, currentY, { width: 380 });
          currentY += doc.heightOfString(`"${sc.narration}"`, { width: 380 }) + 15;

          if (sc.on_screen_text) {
            doc.font('Helvetica-Bold').text('On-Screen Headline Text:', rightColX, currentY);
            currentY += 18;
            doc.font('Helvetica').fillColor('#0284c7').text(sc.on_screen_text, rightColX, currentY, { width: 380 });
            currentY += 25;
          }

          doc.fillColor('#000000').font('Helvetica-Bold').text('Visual Description:', rightColX, currentY);
          currentY += 18;
          doc.font('Helvetica').fillColor('#334155').text(sc.visual_description, rightColX, currentY, { width: 380 });
          currentY += doc.heightOfString(sc.visual_description, { width: 380 }) + 15;

          doc.fillColor('#000000').font('Helvetica-Bold').text('Image Prompt:', rightColX, currentY);
          currentY += 18;
          doc.font('Helvetica-Oblique').fillColor('#64748b').text(sc.image_prompt, rightColX, currentY, { width: 380 });
          currentY += doc.heightOfString(sc.image_prompt, { width: 380 }) + 15;

          if (sc.music_cue) {
            doc.fillColor('#059669').font('Helvetica').text(`Music Cue: ${sc.music_cue}`, rightColX, currentY);
          }
        }
      }

      doc.end();
    });
  }
}
