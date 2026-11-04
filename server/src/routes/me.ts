import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { meReadLimiter, meUpdateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { UpdateProfileSchema } from '@reelforge/shared';
import { AppError } from '../lib/errors.js';

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get('/', meReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { data: profile, error } = await req.supabase!
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new AppError('NOT_FOUND', 404, 'Profile not found');
    }

    res.status(200).json({ data: profile, error: null });
  } catch (err) {
    next(err);
  }
});

meRouter.patch(
  '/',
  meUpdateLimiter,
  validate({ body: UpdateProfileSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { data: updated, error } = await req.supabase!
        .from('profiles')
        .update(req.body)
        .eq('id', userId)
        .select()
        .single();

      if (error || !updated) {
        throw new AppError('INTERNAL', 500, 'Failed to update profile');
      }

      res.status(200).json({ data: updated, error: null });
    } catch (err) {
      next(err);
    }
  }
);

