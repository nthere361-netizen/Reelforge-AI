import { Request, Response, NextFunction } from 'express';
import { User, SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../lib/errors.js';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      supabase?: SupabaseClient;
      token?: string;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('UNAUTHENTICATED', 401, 'Missing or invalid Authorization header'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new AppError('UNAUTHENTICATED', 401, 'Bearer token is empty'));
    }

    // Verify token with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return next(new AppError('UNAUTHENTICATED', 401, 'Invalid or expired session token'));
    }

    req.token = token;
    req.user = data.user;
    req.supabase = createUserClient(token);
    next();
  } catch (err) {
    next(err);
  }
}

