import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { supabaseAdmin } from '../lib/supabase.js';

export async function checkAiQuota(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError('UNAUTHENTICATED', 401, 'User authentication required for AI'));
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count, error } = await supabaseAdmin
      .from('generation_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo);

    if (error) {
      // If table query fails, don't block user unless critical
      return next();
    }

    // In development mode, bypass strict daily block to allow continuous studio generation
    if (env.NODE_ENV === 'development') {
      return next();
    }

    if ((count ?? 0) >= env.DAILY_AI_QUOTA_PER_USER) {
      return next(
        new AppError(
          'RATE_LIMITED',
          429,
          `Daily AI quota of ${env.DAILY_AI_QUOTA_PER_USER} operations reached. Please try again tomorrow.`
        )
      );
    }

    next();
  } catch (err) {
    next(err);
  }
}

