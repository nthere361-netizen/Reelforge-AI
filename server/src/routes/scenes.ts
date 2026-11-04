import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  sceneEditLimiter,
  sceneMutateLimiter,
  sceneRegenLimiter,
  ttsLimiter,
  imageLimiter,
} from '../middleware/rateLimit.js';
import { checkAiQuota } from '../middleware/aiQuota.js';
import { validate } from '../middleware/validate.js';
import { SceneEditSchema, RegenerateSceneSchema } from '@reelforge/shared';
import { ProjectService } from '../services/projectService.js';
import { ScriptService } from '../services/scriptService.js';
import { MediaService } from '../services/mediaService.js';

export const scenesRouter = Router();

scenesRouter.use(requireAuth);

scenesRouter.patch(
  '/:sceneId',
  sceneEditLimiter,
  validate({ body: SceneEditSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await ProjectService.editScene(
        req.params.sceneId,
        req.user!.id,
        req.body,
        req.supabase!
      );
      res.status(200).json({ data: updated, error: null });
    } catch (err) {
      next(err);
    }
  }
);

scenesRouter.delete(
  '/:sceneId',
  sceneMutateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ProjectService.deleteScene(
        req.params.sceneId,
        req.user!.id,
        req.supabase!
      );
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);

scenesRouter.post(
  '/:sceneId/regenerate',
  sceneRegenLimiter,
  checkAiQuota,
  validate({ body: RegenerateSceneSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const regenerated = await ScriptService.regenerateScene(
        req.params.sceneId,
        req.user!.id,
        req.supabase!,
        req.body.instruction
      );
      res.status(200).json({ data: regenerated, error: null });
    } catch (err) {
      next(err);
    }
  }
);

scenesRouter.post(
  '/:sceneId/audio',
  ttsLimiter,
  checkAiQuota,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const result = await MediaService.generateSceneAudio(
        req.params.sceneId,
        req.user!.id,
        req.supabase!
      );
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);

scenesRouter.post(
  '/:sceneId/image',
  imageLimiter,
  checkAiQuota,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const result = await MediaService.generateSceneImage(
        req.params.sceneId,
        req.user!.id,
        req.supabase!
      );
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);

