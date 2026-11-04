import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  generateAllLimiter,
  fullTrackLimiter,
  projectReadLimiter,
} from '../middleware/rateLimit.js';
import { checkAiQuota } from '../middleware/aiQuota.js';
import { MediaService } from '../services/mediaService.js';

export const mediaRouter = Router();

mediaRouter.use(requireAuth);

mediaRouter.post(
  '/:id/media/generate-all',
  generateAllLimiter,
  checkAiQuota,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const force = req.query.force === 'true';
      const result = await MediaService.generateAllMedia(
        req.params.id,
        req.user!.id,
        req.supabase!,
        force
      );
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);

mediaRouter.post(
  '/:id/audio/full-track',
  fullTrackLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const result = await MediaService.concatenateFullTrack(
        req.params.id,
        req.user!.id,
        req.supabase!
      );
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);

mediaRouter.get(
  '/:id/media',
  projectReadLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const urls = await MediaService.getMediaSignedUrls(
        req.params.id,
        req.user!.id,
        req.supabase!
      );
      res.status(200).json({ data: urls, error: null });
    } catch (err) {
      next(err);
    }
  }
);

