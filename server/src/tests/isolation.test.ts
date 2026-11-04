import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

// Define test users A and B
const USER_A_ID = '11111111-1111-4111-8111-111111111111';
const USER_B_ID = '22222222-2222-4222-8222-222222222222';

const userA = { id: USER_A_ID, email: 'user.a@example.com' };
const userB = { id: USER_B_ID, email: 'user.b@example.com' };

// In-memory data store to simulate multi-tenant Supabase PostgreSQL
let memoryStore: {
  projects: any[];
  scripts: any[];
  scenes: any[];
  content_analyses: any[];
  audio_assets: any[];
  image_assets: any[];
  exports: any[];
  generation_logs: any[];
} = {
  projects: [],
  scripts: [],
  scenes: [],
  content_analyses: [],
  audio_assets: [],
  image_assets: [],
  exports: [],
  generation_logs: [],
};

// Mock Gemini AI calls so isolation tests verify access boundaries purely
vi.mock('../lib/gemini.js', () => ({
  generateStructured: vi.fn(async () => ({})),
  synthesizeSpeech: vi.fn(async () => ({ wav: Buffer.alloc(100), durationMs: 1000 })),
  generateImage: vi.fn(async () => ({ imageBuffer: Buffer.alloc(100), mimeType: 'image/png' })),
}));

// Mock Supabase
vi.mock('../lib/supabase.js', () => {
  function createScopedClient(currentUserId?: string) {
    return {
      from: (table: keyof typeof memoryStore) => {
        let filters: Array<(item: any) => boolean> = [];

        // RLS simulation: If client is authenticated as a user, only rows matching user_id are visible
        if (currentUserId && table !== 'generation_logs') {
          filters.push((row: any) => row.user_id === currentUserId);
        }

        const builder: any = {
          select: (_columns?: string, _opts?: any) => builder,
          insert: (records: any | any[]) => {
            const arr = Array.isArray(records) ? records : [records];
            const inserted = arr.map((rec) => {
              const full = { id: rec.id || `mock-${Date.now()}-${Math.random()}`, ...rec };
              memoryStore[table]?.push(full);
              return full;
            });
            builder._lastResult = Array.isArray(records) ? inserted : inserted[0];
            return builder;
          },
          update: (updates: any) => {
            builder._pendingUpdate = updates;
            return builder;
          },
          delete: () => {
            builder._pendingDelete = true;
            return builder;
          },
          eq: (column: string, value: any) => {
            filters.push((row: any) => row[column] === value);
            return builder;
          },
          gte: () => builder,
          gt: () => builder,
          ilike: () => builder,
          order: () => builder,
          range: () => builder,
          single: async () => {
            const items = (memoryStore[table] || []).filter((row) => filters.every((f) => f(row)));
            if (builder._pendingUpdate) {
              const match = items[0];
              if (!match) return { data: null, error: { message: 'Row not found' } };
              Object.assign(match, builder._pendingUpdate);
              return { data: match, error: null };
            }
            if (!items.length) return { data: null, error: { message: 'Row not found' } };
            return { data: items[0], error: null };
          },
          then: async (resolve: any) => {
            if (builder._pendingDelete) {
              const beforeCount = memoryStore[table]?.length || 0;
              memoryStore[table] = (memoryStore[table] || []).filter((row) => !filters.every((f) => f(row)));
              const deletedCount = beforeCount - memoryStore[table].length;
              return resolve({ data: null, error: null, count: deletedCount });
            }
            if (builder._lastResult !== undefined) {
              return resolve({ data: builder._lastResult, error: null });
            }
            const data = (memoryStore[table] || []).filter((row) => filters.every((f) => f(row)));
            return resolve({ data, count: data.length, error: null });
          },
        };

        return builder;
      },
    };
  }

  const adminClient = {
    ...createScopedClient(),
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'token-user-a') return { data: { user: userA }, error: null };
        if (token === 'token-user-b') return { data: { user: userB }, error: null };
        return { data: { user: null }, error: { message: 'Invalid token' } };
      }),
    },
    storage: {
      from: () => ({
        list: vi.fn(async () => ({ data: [] })),
        remove: vi.fn(async () => ({ data: [] })),
        createSignedUrl: vi.fn(async (path: string) => ({
          data: { signedUrl: `https://mock-storage.test/${path}?token=mock` },
        })),
        download: vi.fn(async () => ({
          data: { arrayBuffer: async () => new ArrayBuffer(10) },
          error: null,
        })),
      }),
    },
  };

  return {
    supabaseAdmin: adminClient,
    createUserClient: vi.fn((token: string) => {
      if (token === 'token-user-a') return createScopedClient(USER_A_ID);
      if (token === 'token-user-b') return createScopedClient(USER_B_ID);
      return createScopedClient();
    }),
  };
});

describe('Data Isolation & Multi-Tenancy (Section 11 & Appendix F)', () => {
  const projectAId = 'proj-user-a-12345';
  const scriptAId = 'script-user-a-12345';
  const sceneAId = 'scene-user-a-12345';

  beforeEach(() => {
    // 1. Seed initial data belonging exclusively to User A
    memoryStore = {
      projects: [
        {
          id: projectAId,
          user_id: USER_A_ID,
          title: "User A's Confidential FinTech Video",
          source_type: 'paste',
          source_text: 'Top wealth management strategies for 2026.',
          source_word_count: 50,
          domain: 'finance',
          target_platform: 'youtube_shorts',
          aspect_ratio: '9:16',
          target_duration_seconds: 30,
          tone: 'authoritative',
          language: 'en',
          audience: 'investors',
          voice_name: 'Puck',
          visual_style: 'cinematic',
          include_cta: true,
          status: 'scripted',
          created_at: new Date().toISOString(),
        },
      ],
      scripts: [
        {
          id: scriptAId,
          project_id: projectAId,
          user_id: USER_A_ID,
          version: 1,
          video_title: 'Confidential Finance Masterclass',
          hook: 'Are you leaving money on the table?',
          call_to_action: 'Subscribe for daily wealth tips',
          caption_text: 'Financial freedom guide #finance',
          hashtags: ['finance', 'wealth'],
          total_duration_seconds: 30,
          is_active: true,
        },
      ],
      scenes: [
        {
          id: sceneAId,
          script_id: scriptAId,
          project_id: projectAId,
          user_id: USER_A_ID,
          scene_index: 0,
          duration_seconds: 10,
          narration: 'Are you leaving money on the table every month?',
          on_screen_text: 'Stop Losing Money',
          visual_description: 'A modern skyscraper stock exchange floor',
          image_prompt: 'High resolution trading terminal',
          camera_motion: 'slow_zoom_in',
          transition: 'cut',
          mood: 'serious',
          music_cue: 'subtle bass pulse',
        },
      ],
      content_analyses: [
        {
          project_id: projectAId,
          user_id: USER_A_ID,
          summary: 'Summary of User A private doc',
          key_points: ['Point 1', 'Point 2'],
          detected_topic: 'Finance',
          audience_insights: 'High net worth individuals',
          recommended_structure: 'Hook -> Point -> CTA',
        },
      ],
      audio_assets: [
        {
          id: 'audio-a-1',
          project_id: projectAId,
          user_id: USER_A_ID,
          scene_id: sceneAId,
          kind: 'scene',
          storage_path: `${USER_A_ID}/${projectAId}/audio/scene-0.wav`,
          duration_ms: 10000,
        },
      ],
      image_assets: [
        {
          id: 'img-a-1',
          project_id: projectAId,
          user_id: USER_A_ID,
          scene_id: sceneAId,
          storage_path: `${USER_A_ID}/${projectAId}/images/scene-0.png`,
          aspect_ratio: '9:16',
          mime_type: 'image/png',
        },
      ],
      exports: [],
      generation_logs: [],
    };
  });

  it("User B receives 404 NOT_FOUND when attempting to read User A's project", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}`)
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.data).toBeNull();
  });

  it("User B receives 404 NOT_FOUND when attempting to update User A's project", async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectAId}`)
      .set('Authorization', 'Bearer token-user-b')
      .send({ title: 'Hacked by User B' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    // Verify User A's title was NOT changed
    const original = memoryStore.projects.find((p) => p.id === projectAId);
    expect(original.title).toBe("User A's Confidential FinTech Video");
  });

  it("User B receives 404 NOT_FOUND when attempting to delete User A's project", async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${projectAId}`)
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    // Verify project still exists in store
    const exists = memoryStore.projects.some((p) => p.id === projectAId);
    expect(exists).toBe(true);
  });

  it("User B receives 404 NOT_FOUND when attempting to edit User A's scene", async () => {
    const res = await request(app)
      .patch(`/api/v1/scenes/${sceneAId}`)
      .set('Authorization', 'Bearer token-user-b')
      .send({ narration: 'Tampered narration by B' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const scene = memoryStore.scenes.find((s) => s.id === sceneAId);
    expect(scene.narration).toBe('Are you leaving money on the table every month?');
  });

  it("User B receives 404 NOT_FOUND when attempting to delete User A's scene", async () => {
    const res = await request(app)
      .delete(`/api/v1/scenes/${sceneAId}`)
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const exists = memoryStore.scenes.some((s) => s.id === sceneAId);
    expect(exists).toBe(true);
  });

  it("User B receives 404 NOT_FOUND when attempting to access User A's signed audio/media URLs", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/media`)
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it("User B receives 404 NOT_FOUND when attempting to trigger AI analysis on User A's project", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/analyze`)
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it("User B receives 404 NOT_FOUND when attempting to trigger script generation on User A's project", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/script`)
      .set('Authorization', 'Bearer token-user-b')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it("User B receives 404 NOT_FOUND when attempting to trigger media generation on User A's project", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/media/generate-all`)
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it("User B receives 404 NOT_FOUND when attempting to trigger scene audio generation on User A's scene", async () => {
    const res = await request(app)
      .post(`/api/v1/scenes/${sceneAId}/audio`)
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it("User B receives 404 NOT_FOUND when attempting to trigger scene image generation on User A's scene", async () => {
    const res = await request(app)
      .post(`/api/v1/scenes/${sceneAId}/image`)
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it("User B receives 404 NOT_FOUND when attempting to trigger scene regeneration on User A's scene", async () => {
    const res = await request(app)
      .post(`/api/v1/scenes/${sceneAId}/regenerate`)
      .set('Authorization', 'Bearer token-user-b')
      .send({ instruction: 'Make it more dramatic' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it("User B receives 404 NOT_FOUND when attempting to export User A's project as JSON", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/export/json`)
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it("User B receives 404 NOT_FOUND when attempting to export User A's project as SRT", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/export/srt`)
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it("Confirms User A's project, script, and scene data remain completely unmodified", () => {
    const proj = memoryStore.projects.find((p) => p.id === projectAId);
    expect(proj).toBeDefined();
    expect(proj.title).toBe("User A's Confidential FinTech Video");
    expect(proj.user_id).toBe(USER_A_ID);

    const script = memoryStore.scripts.find((s) => s.id === scriptAId);
    expect(script).toBeDefined();
    expect(script.video_title).toBe('Confidential Finance Masterclass');
    expect(script.user_id).toBe(USER_A_ID);

    const scene = memoryStore.scenes.find((s) => s.id === sceneAId);
    expect(scene).toBeDefined();
    expect(scene.narration).toBe('Are you leaving money on the table every month?');
    expect(scene.user_id).toBe(USER_A_ID);
  });
});
