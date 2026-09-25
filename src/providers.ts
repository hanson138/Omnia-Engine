import { z } from 'zod';
import type { ActiveMode, CharacterCognitionInput, CharacterCognitionProvider, CognitionSnapshot, Strategy } from './types.js';

export const strategies = ['answer_directly', 'ask_question', 'challenge', 'deflect', 'conceal', 'reassure', 'warn', 'confront', 'change_topic', 'remain_silent', 'observe', 'disengage'] as const satisfies readonly Strategy[];
export const snapshotSchema = z.strictObject({
  requestId: z.string(), chatId: z.string(), characterId: z.string(), sourceMessageId: z.number().int(),
  salientEvidence: z.array(z.strictObject({ candidateId: z.string(), relevanceSignal: z.number().min(0).max(1).optional() })).max(20),
  responseTendency: z.strictObject({ strategy: z.enum(strategies), confidence: z.number().min(0).max(1).optional() }).optional(),
  providerStatus: z.literal('ok'), latencyMs: z.number().nonnegative(), createdAt: z.string(),
});

export function validateSnapshot(value: unknown, input: CharacterCognitionInput, mode: ActiveMode): value is CognitionSnapshot {
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) return false;
  const data = parsed.data;
  if (data.requestId !== input.requestId || data.chatId !== input.chatId || data.characterId !== input.character.id || data.sourceMessageId !== input.currentSituation.sourceMessageId) return false;
  if (mode === 'RELEVANCE' && data.responseTendency) return false;
  const known = new Set(input.candidates.map(candidate => candidate.id));
  return new Set(data.salientEvidence.map(item => item.candidateId)).size === data.salientEvidence.length && data.salientEvidence.every(item => known.has(item.candidateId));
}

export class MockCognitionProvider implements CharacterCognitionProvider {
  async evaluate(input: CharacterCognitionInput, mode: ActiveMode, signal: AbortSignal): Promise<CognitionSnapshot> {
    if (signal.aborted) throw signal.reason;
    const salient = input.candidates.filter((_, index) => index % 2 === 0).slice(0, 4);
    return {
      requestId: input.requestId, chatId: input.chatId, characterId: input.character.id,
      sourceMessageId: input.currentSituation.sourceMessageId,
      salientEvidence: salient.map(item => ({ candidateId: item.id })),
      ...(mode === 'RELEVANCE' ? {} : { responseTendency: { strategy: 'challenge' as const } }),
      providerStatus: 'ok', latencyMs: 0, createdAt: new Date().toISOString(),
    };
  }
}

export class LocalJevBridgeProvider implements CharacterCognitionProvider {
  constructor(private readonly url: string, private readonly request: typeof fetch = fetch) {
    const parsed = new URL(url);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || parsed.protocol !== 'http:') throw new Error('Bridge URL must be local HTTP');
  }
  async evaluate(input: CharacterCognitionInput, mode: ActiveMode, signal: AbortSignal): Promise<CognitionSnapshot> {
    const response = await this.request(this.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input, mode }), signal });
    if (!response.ok) throw new Error(`Bridge HTTP ${response.status}`);
    const result: unknown = await response.json();
    if (!validateSnapshot(result, input, mode)) throw new Error('Invalid bridge cognition response');
    return result;
  }
}
