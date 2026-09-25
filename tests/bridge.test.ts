import { describe, expect, it } from 'vitest';
import { createBridgeServer } from '../bridge/server.js';
import type { CharacterCognitionInput, CognitionSnapshot } from '../src/types.js';

const input: CharacterCognitionInput = {
  requestId: 'r1', chatId: 'c1', character: { id: 'bob', name: 'Bob', description: 'Careful' },
  currentSituation: { latestUserInput: 'Basement?', recentDialogue: 'user: Basement?', sourceMessageId: 1 },
  candidates: [{ id: 'm1', sourceType: 'message', content: 'Basement?', epistemicStatus: 'utterance' }],
};
const answer: CognitionSnapshot = { requestId: 'r1', chatId: 'c1', characterId: 'bob', sourceMessageId: 1, salientEvidence: [{ candidateId: 'm1' }], providerStatus: 'ok', latencyMs: 1, createdAt: 'now' };

describe('local bridge', () => {
  it('accepts only configured browser origin and valid cognition input', async () => {
    const server = createBridgeServer({ allowedOrigin: 'http://127.0.0.1:8000', evaluate: async () => answer });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw Error('no address');
      const url = `http://127.0.0.1:${address.port}/jev/evaluate`;
      const good = await fetch(url, { method: 'POST', headers: { origin: 'http://127.0.0.1:8000', 'content-type': 'application/json' }, body: JSON.stringify({ input, mode: 'RELEVANCE' }) });
      expect(good.status).toBe(200);
      expect((await good.json()).salientEvidence[0].candidateId).toBe('m1');
      const forbidden = await fetch(url, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ input, mode: 'RELEVANCE' }) });
      expect(forbidden.status).toBe(403);
      const invalid = await fetch(url, { method: 'POST', headers: { origin: 'http://127.0.0.1:8000', 'content-type': 'application/json' }, body: JSON.stringify({ input: { ...input, candidates: [{ ...input.candidates[0], content: 'x'.repeat(9000) }] }, mode: 'RELEVANCE' }) });
      expect(invalid.status).toBe(400);
    } finally { server.close(); }
  });
});
