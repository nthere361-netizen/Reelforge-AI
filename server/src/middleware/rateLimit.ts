import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export function createLimiter(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, else IP
      return req.user?.id || req.ip || 'anonymous';
    },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        data: null,
        error: {
          code: 'RATE_LIMITED',
          message,
        },
      });
    },
  });
}

// Pre-configured limiters per Section 12 specifications (generous development limits to avoid blocking active studios)
export const healthLimiter = createLimiter(60 * 1000, 300, 'Too many health check requests.');
export const meReadLimiter = createLimiter(60 * 1000, 300, 'Too many profile requests.');
export const meUpdateLimiter = createLimiter(60 * 1000, 100, 'Too many profile update requests.');
export const sourceExtractLimiter = createLimiter(60 * 60 * 1000, 100, 'Source extraction rate limit reached (100/hour).');
export const sourceUrlLimiter = createLimiter(60 * 60 * 1000, 100, 'URL extraction rate limit reached (100/hour).');
export const projectReadLimiter = createLimiter(60 * 1000, 300, 'Too many project read requests.');
export const projectCreateLimiter = createLimiter(60 * 60 * 1000, 100, 'Project creation limit reached (100/hour).');
export const projectUpdateLimiter = createLimiter(60 * 1000, 200, 'Too many project update requests.');
export const projectDuplicateLimiter = createLimiter(60 * 60 * 1000, 100, 'Project duplicate limit reached (100/hour).');
export const projectDeleteLimiter = createLimiter(60 * 60 * 1000, 100, 'Project deletion limit reached (100/hour).');
export const aiAnalysisLimiter = createLimiter(60 * 60 * 1000, 60, 'Analysis rate limit reached (60/hour).');
export const aiScriptLimiter = createLimiter(60 * 60 * 1000, 60, 'Script generation rate limit reached (60/hour).');
export const sceneEditLimiter = createLimiter(60 * 1000, 300, 'Too many scene edits.');
export const sceneMutateLimiter = createLimiter(60 * 1000, 200, 'Too many scene operations.');
export const sceneRegenLimiter = createLimiter(60 * 60 * 1000, 100, 'Scene regeneration rate limit reached (100/hour).');
export const ttsLimiter = createLimiter(60 * 60 * 1000, 200, 'Voiceover generation limit reached (200/hour).');
export const imageLimiter = createLimiter(60 * 60 * 1000, 200, 'Image generation limit reached (200/hour).');
export const generateAllLimiter = createLimiter(60 * 60 * 1000, 60, 'Generate-all limit reached (60/hour).');
export const fullTrackLimiter = createLimiter(60 * 60 * 1000, 100, 'Full track concatenation limit reached (100/hour).');
export const exportLimiter = createLimiter(60 * 1000, 180, 'Export rate limit reached.');
export const exportHeavyLimiter = createLimiter(60 * 1000, 100, 'Export rate limit reached.');

