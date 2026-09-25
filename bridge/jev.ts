import type { ActiveMode, CharacterCognitionInput, CognitionSnapshot, Strategy } from '../src/types.js';
import { strategies } from '../src/providers.js';

type JevClient = { evaluate(request: { state: unknown; questions: Record<string, { type: 'choice'; instructions: string; criteria: Record<string, string> }>; signal?: AbortSignal }): Promise<{ answers: Record<string, { type: string; choice?: string; probabilities?: Record<string, number>; confidence?: number }>; latencyMs: number }> };
let clientPromise: Promise<JevClient> | undefined;

async function client(): Promise<JevClient> {
  clientPromise ??= import(new URL('../omnia-engine/packages/jev/dist/index.js', new URL('../', import.meta.url)).href)
    .then(module => new module.AiSdkJevClient({ maxRetries: 0 }) as JevClient);
  return clientPromise;
}

export async function evaluateWithJev(input: CharacterCognitionInput, mode: ActiveMode, signal: AbortSignal): Promise<CognitionSnapshot> {
  if (!process.env.AI_GATEWAY_API_KEY) throw new Error('bridge unavailable: AI_GATEWAY_API_KEY is not set');
  const evidenceOptions = Object.fromEntries(input.candidates.map(item => [item.id, `${item.epistemicStatus}: ${item.content.slice(0, 180)}`]));
  const questions = {
    focus: { type: 'choice' as const, instructions: 'Select the one source item most salient to this character now. Do not treat utterances as objective facts.', criteria: { none: 'No candidate is salient', ...evidenceOptions } },
    ...(mode === 'RELEVANCE' ? {} : { strategy: { type: 'choice' as const, instructions: 'Choose the response tendency most consistent with this character and current situation. This is not dialogue text.', criteria: Object.fromEntries(strategies.map(name => [name, name.replaceAll('_', ' ')])) } }),
  };
  const result = await (await client()).evaluate({ state: { character: input.character, currentSituation: input.currentSituation, candidates: input.candidates }, questions, signal });
  const selected = result.answers.focus;
  if (selected?.type !== 'choice' || !selected.choice || (selected.choice !== 'none' && !input.candidates.some(item => item.id === selected.choice))) throw new Error('Jev returned invalid evidence selection');
  const tendency = result.answers.strategy;
  if (mode !== 'RELEVANCE' && (tendency?.type !== 'choice' || !strategies.includes(tendency.choice as Strategy))) throw new Error('Jev returned invalid strategy');
  return {
    requestId: input.requestId, chatId: input.chatId, characterId: input.character.id, sourceMessageId: input.currentSituation.sourceMessageId,
    salientEvidence: selected.choice === 'none' ? [] : [{ candidateId: selected.choice, ...(selected.probabilities?.[selected.choice] === undefined ? {} : { relevanceSignal: selected.probabilities[selected.choice] }) }],
    ...(mode === 'RELEVANCE' ? {} : { responseTendency: { strategy: tendency!.choice as Strategy, ...(tendency!.confidence === undefined ? {} : { confidence: tendency!.confidence }) } }),
    providerStatus: 'ok', latencyMs: result.latencyMs, createdAt: new Date().toISOString(),
  };
}
