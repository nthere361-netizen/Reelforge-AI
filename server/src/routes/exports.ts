import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { exportLimiter, exportHeavyLimiter } from '../middleware/rateLimit.js';
import { ExportService } from '../services/exportService.js';
import { VideoRenderService } from '../services/videoRenderService.js';

export const exportsRouter = Router();

exportsRouter.use(requireAuth);

function sanitizeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 50) || 'reelforge-video';
}

exportsRouter.get(
  '/:id/export/json',
  exportLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const data = await ExportService.exportJson(req.params.id, req.user!.id, req.supabase!);
      const filename = `${sanitizeSlug(data.project.title)}-script.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
);

exportsRouter.get(
  '/:id/export/srt',
  exportLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const srt = await ExportService.exportSrt(req.params.id, req.user!.id, req.supabase!);
      res.setHeader('Content-Disposition', 'attachment; filename="captions.srt"');
      res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
      res.status(200).send(srt);
    } catch (err) {
      next(err);
    }
  }
);

exportsRouter.get(
  '/:id/export/vtt',
  exportLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const vtt = await ExportService.exportVtt(req.params.id, req.user!.id, req.supabase!);
      res.setHeader('Content-Disposition', 'attachment; filename="captions.vtt"');
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.status(200).send(vtt);
    } catch (err) {
      next(err);
    }
  }
);

exportsRouter.get(
  '/:id/export/audio',
  exportHeavyLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const wav = await ExportService.exportAudioWav(req.params.id, req.user!.id, req.supabase!);
      res.setHeader('Content-Disposition', 'attachment; filename="voiceover-full.wav"');
      res.setHeader('Content-Type', 'audio/wav');
      res.status(200).send(wav);
    } catch (err) {
      next(err);
    }
  }
);

exportsRouter.get(
  '/:id/export/images.zip',
  exportHeavyLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const zipStream = await ExportService.exportImagesZip(req.params.id, req.user!.id, req.supabase!);
      res.setHeader('Content-Disposition', 'attachment; filename="storyboard-images.zip"');
      res.setHeader('Content-Type', 'application/zip');
      zipStream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
);

exportsRouter.get(
  '/:id/export/storyboard.pdf',
  exportHeavyLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const pdf = await ExportService.exportStoryboardPdf(req.params.id, req.user!.id, req.supabase!);
      res.setHeader('Content-Disposition', 'attachment; filename="storyboard.pdf"');
      res.setHeader('Content-Type', 'application/pdf');
      res.status(200).send(pdf);
    } catch (err) {
      next(err);
    }
  }
);

exportsRouter.get(
  '/:id/export/video.mp4',
  exportHeavyLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const mp4Buffer = await VideoRenderService.renderVideoMp4(req.params.id, req.user!.id, req.supabase!);
      res.setHeader('Content-Disposition', 'attachment; filename="reelforge-video.mp4"');
      res.setHeader('Content-Type', 'video/mp4');
      res.status(200).send(mp4Buffer);
    } catch (err) {
      next(err);
    }
  }
);

