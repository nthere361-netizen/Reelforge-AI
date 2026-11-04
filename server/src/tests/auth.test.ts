import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Auth & Protected Routes', () => {
  it('returns 401 UNAUTHENTICATED on GET /api/v1/me without token', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 UNAUTHENTICATED on GET /api/v1/projects without token', async () => {
    const res = await request(app).get('/api/v1/projects');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects malformed Authorization header with 401', async () => {
    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', 'Basic 12345');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

