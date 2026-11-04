import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  projectReadLimiter,
  projectCreateLimiter,
  projectUpdateLimiter,
  projectDuplicateLimiter,
  projectDeleteLimiter,
  aiAnalysisLimiter,
  aiScriptLimiter,
  sceneMutateLimiter,
} from '../middleware/rateLimit.js';
import { checkAiQuota } from '../middleware/aiQuota.js';
import { validate } from '../middleware/validate.js';
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  AddSceneSchema,
  ReorderScenesSchema,
  ScriptGenerateSchema,
  TranslateScriptRequestSchema,
  CopilotRequestSchema,
} from '@reelforge/shared';
import { ProjectService } from '../services/projectService.js';
import { AnalysisService } from '../services/analysisService.js';
import { ScriptService } from '../services/scriptService.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get('/', projectReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ProjectService.listProjects(req.user!.id, req.query, req.supabase!);
    res.status(200).json({ data: result, error: null });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post(
  '/',
  projectCreateLimiter,
  validate({ body: CreateProjectRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await ProjectService.createProject(req.user!.id, req.body, req.supabase!);
      res.status(201).json({ data: project, error: null });
    } catch (err) {
      next(err);
    }
  }
);

projectsRouter.get('/:id', projectReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await ProjectService.getProject(req.params.id, req.user!.id, req.supabase!);
    res.status(200).json({ data: project, error: null });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch(
  '/:id',
  projectUpdateLimiter,
  validate({ body: UpdateProjectRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await ProjectService.updateProject(
        req.params.id,
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

projectsRouter.post('/:id/duplicate', projectDuplicateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dup = await ProjectService.duplicateProject(req.params.id, req.user!.id, req.supabase!);
    res.status(201).json({ data: dup, error: null });
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:id', projectDeleteLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ProjectService.deleteProject(req.params.id, req.user!.id, req.supabase!);
    res.status(200).json({ data: result, error: null });
  } catch (err) {
    next(err);
  }
});

// AI Content Analysis
projectsRouter.post(
  '/:id/analyze',
  aiAnalysisLimiter,
  checkAiQuota,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const analysis = await AnalysisService.analyzeProject(
        req.params.id,
        req.user!.id,
        req.supabase!
      );
      res.status(200).json({ data: analysis, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// AI Script Generation
projectsRouter.post(
  '/:id/script',
  aiScriptLimiter,
  checkAiQuota,
  validate({ body: ScriptGenerateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const result = await ScriptService.generateScript(
        req.params.id,
        req.user!.id,
        req.supabase!,
        req.body.extra_instructions
      );
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// Script Versions
projectsRouter.get('/:id/scripts', projectReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await ProjectService.listScriptVersions(req.params.id, req.user!.id, req.supabase!);
    res.status(200).json({ data: versions, error: null });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post(
  '/:id/scripts/:scriptId/activate',
  projectUpdateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const activated = await ProjectService.activateScriptVersion(
        req.params.id,
        req.params.scriptId,
        req.user!.id,
        req.supabase!
      );
      res.status(200).json({ data: activated, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// Scenes Sub-Routes on Project
projectsRouter.post(
  '/:id/scenes',
  sceneMutateLimiter,
  validate({ body: AddSceneSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scene = await ProjectService.addScene(
        req.params.id,
        req.user!.id,
        req.body,
        req.supabase!
      );
      res.status(201).json({ data: scene, error: null });
    } catch (err) {
      next(err);
    }
  }
);

projectsRouter.put(
  '/:id/scenes/order',
  sceneMutateLimiter,
  validate({ body: ReorderScenesSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scenes = await ProjectService.reorderScenes(
        req.params.id,
        req.user!.id,
        req.body.ordered_scene_ids,
        req.supabase!
      );
      res.status(200).json({ data: scenes, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// Feature 5: Multilingual Script Translation
projectsRouter.post(
  '/:id/translate',
  aiScriptLimiter,
  checkAiQuota,
  validate({ body: TranslateScriptRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const result = await ScriptService.translateScript(
        req.params.id,
        req.user!.id,
        req.supabase!,
        req.body.target_language
      );
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// Feature 7: Content Quality & Fact-Checking Audit
projectsRouter.post(
  '/:id/quality-audit',
  aiAnalysisLimiter,
  checkAiQuota,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const audit = await ScriptService.auditQuality(
        req.params.id,
        req.user!.id,
        req.supabase!
      );
      res.status(200).json({ data: audit, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// Feature 6: Cross-Platform Content Repurposing
projectsRouter.post(
  '/:id/repurpose',
  aiScriptLimiter,
  checkAiQuota,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const repurposed = await ScriptService.repurposeVideo(
        req.params.id,
        req.user!.id,
        req.supabase!
      );
      res.status(200).json({ data: repurposed, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// Feature 4: Interactive ReelForge Copilot
projectsRouter.post(
  '/:id/copilot',
  aiScriptLimiter,
  checkAiQuota,
  validate({ body: CopilotRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const response = await ScriptService.copilotAssist({
        projectId: req.params.id,
        userId: req.user!.id,
        supabase: req.supabase!,
        message: req.body.message,
        actionType: req.body.action_type,
        sceneIndex: req.body.scene_index,
      });
      res.status(200).json({ data: response, error: null });
    } catch (err) {
      next(err);
    }
  }
);

