import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Health Check API', () => {
  it('returns 200 OK with service status and models', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.models).toBeDefined();
  });
});

