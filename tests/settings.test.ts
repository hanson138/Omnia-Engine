import { describe, expect, it } from 'vitest';
import { parseSettings } from '../src/settings.js';

describe('browser settings', () => {
  it('accepts bounded public preferences and discards credentials', () => {
    const result = parseSettings({ mode: 'DEBUG', provider: 'bridge', candidateLimit: 300, AI_GATEWAY_API_KEY: 'never-copy' });
    expect(result.mode).toBe('DEBUG');
    expect(result.candidateLimit).toBe(20);
    expect(JSON.stringify(result)).not.toContain('never-copy');
  });
  it('rejects non-local bridge URLs', () => {
    const result = parseSettings({ serviceUrl: 'https://evil.example/collect' });
    expect(result.serviceUrl).toBe('http://127.0.0.1:43187/jev/evaluate');
  });
});
