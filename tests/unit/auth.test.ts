import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock config before importing auth
vi.mock('../../src/config', () => ({
  config: {
    apiKeys: ['key-one', 'key-two'],
    port: 3000,
    cliTimeoutMs: 30000,
    rateLimitPerMinute: 30,
    cliPath: 'lark-cli',
  },
}));

import { authMiddleware } from '../../src/middleware/auth';

function mockReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    ip: '127.0.0.1',
    method: 'POST',
    path: '/api/v1/lookup',
  } as unknown as Request;
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('authMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('should return 401 when Authorization header is missing', () => {
    const req = mockReq(undefined);
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 2001 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header is empty', () => {
    const req = mockReq('');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 2001 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header does not start with Bearer', () => {
    const req = mockReq('Basic key-one');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 2001 })
    );
  });

  it('should return 401 for an invalid API key', () => {
    const req = mockReq('Bearer wrong-key');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 2002 })
    );
  });

  it('should call next() for a valid API key (first key)', () => {
    const req = mockReq('Bearer key-one');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() for a valid API key (second key)', () => {
    const req = mockReq('Bearer key-two');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should trim extra whitespace in Authorization header', () => {
    const req = mockReq('  Bearer   key-one  ');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
