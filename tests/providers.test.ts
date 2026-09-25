import { describe, expect, it } from 'vitest';
import { MockCognitionProvider, LocalJevBridgeProvider, validateSnapshot } from '../src/providers.js';
import type { CharacterCognitionInput } from '../src/types.js';

const input: CharacterCognitionInput = {
  requestId: 'r1', chatId: 'chat', character: { id: 'bob', name: 'Bob', description: '' },
  currentSituation: { latestUserInput: 'Alice?', recentDialogue: '', sourceMessageId: 1 },
  candidates: [
    { id: 'm1', sourceType: 'message', content: 'Bob saw Alice', epistemicStatus: 'utterance' },
    { id: 'm2', sourceType: 'message', content: 'Tea', epistemicStatus: 'utterance' },
    { id: 'm3', sourceType: 'worldbook', content: 'Basement', epistemicStatus: 'lore' },
  ],
};

describe('cognition provider', () => {
  it('selects only known IDs in deterministic mock mode', async () => {
    const result = await new MockCognitionProvider().evaluate(input, 'COGNITION', new AbortController().signal);
    expect(result.salientEvidence.map(x => x.candidateId)).toEqual(['m1', 'm3']);
    expect(result.responseTendency?.strategy).toBe('challenge');
    expect(validateSnapshot(result, input, 'COGNITION')).toBe(true);
  });
  it('rejects invented evidence IDs', () => {
    expect(validateSnapshot({ requestId: 'r1', chatId: 'chat', characterId: 'bob', sourceMessageId: 1, salientEvidence: [{ candidateId: 'invented' }], providerStatus: 'ok', latencyMs: 1, createdAt: 'now' }, input, 'RELEVANCE')).toBe(false);
  });
  it('rejects malformed localhost responses without exposing them as cognition', async () => {
    const provider = new LocalJevBridgeProvider('http://127.0.0.1:43187/jev/evaluate', async () => new Response(JSON.stringify({ ...input, salientEvidence: [{ candidateId: 'invented' }] }), { status: 200 }));
    await expect(provider.evaluate(input, 'RELEVANCE', new AbortController().signal)).rejects.toThrow('Invalid bridge cognition response');
  });
});
