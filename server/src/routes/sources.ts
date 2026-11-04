import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { sourceExtractLimiter, sourceUrlLimiter, aiAnalysisLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  FetchUrlRequestSchema,
  ExpandIdeaRequestSchema,
  DocumentTopicsRequestSchema,
} from '@reelforge/shared';
import { SourceService } from '../services/sourceService.js';
import { AppError } from '../lib/errors.js';

export const sourcesRouter = Router();

sourcesRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

sourcesRouter.post(
  '/extract',
  sourceExtractLimiter,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('VALIDATION_ERROR', 400, 'No file uploaded');
      }

      const extracted = await SourceService.extractFromUpload(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      const normalized = SourceService.normalizeText(extracted);

      res.status(200).json({
        data: {
          text: normalized.text,
          word_count: normalized.wordCount,
          truncated: normalized.truncated,
          filename: req.file.originalname,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

sourcesRouter.post(
  '/fetch-url',
  sourceUrlLimiter,
  validate({ body: FetchUrlRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url } = req.body;
      const extracted = await SourceService.extractFromUrl(url);
      const normalized = SourceService.normalizeText(extracted);

      res.status(200).json({
        data: {
          text: normalized.text,
          word_count: normalized.wordCount,
          truncated: normalized.truncated,
          url,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Feature 1: AI Idea-to-Video Blueprint Expansion
sourcesRouter.post(
  '/expand-idea',
  aiAnalysisLimiter,
  validate({ body: ExpandIdeaRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ideaText = req.body.idea || req.body.topic;
      const domainVal = req.body.preferred_domain || req.body.domain;
      const platformVal = req.body.preferred_platform || req.body.target_platform;
      const result = await SourceService.expandIdea({
        idea: ideaText,
        preferredDomain: domainVal,
        preferredPlatform: platformVal,
      });
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// Feature 2: Document Topic Breakdown Extraction
sourcesRouter.post(
  '/document-topics',
  aiAnalysisLimiter,
  validate({ body: DocumentTopicsRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const result = await SourceService.extractDocumentTopics(req.body.text);
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);

