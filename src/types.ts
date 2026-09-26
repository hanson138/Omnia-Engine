export type CognitionMode = 'OFF' | 'RELEVANCE' | 'COGNITION' | 'DEBUG';
export type ActiveMode = Exclude<CognitionMode, 'OFF'>;
export type Strategy = 'answer_directly' | 'ask_question' | 'challenge' | 'deflect' | 'conceal' | 'reassure' | 'warn' | 'confront' | 'change_topic' | 'remain_silent' | 'observe' | 'disengage';

export interface CognitionCandidate {
  id: string;
  sourceType: 'card' | 'message' | 'worldbook';
  content: string;
  epistemicStatus: 'self_description' | 'utterance' | 'lore';
  sourceMessageId?: number;
  worldbookEntryId?: string;
  sourceName?: string;
}

export interface CharacterCognitionInput {
  requestId: string;
  chatId: string;
  character: { id: string; name: string; description: string; personality?: string };
  currentSituation: { latestUserInput: string; recentDialogue: string; sourceMessageId: number };
  candidates: CognitionCandidate[];
}

export interface CognitionSnapshot {
  requestId: string;
  chatId: string;
  characterId: string;
  sourceMessageId: number;
  salientEvidence: { candidateId: string; relevanceSignal?: number }[];
  responseTendency?: { strategy: Strategy; confidence?: number };
  providerStatus: 'ok';
  latencyMs: number;
  createdAt: string;
}

export interface CharacterCognitionProvider {
  evaluate(input: CharacterCognitionInput, mode: ActiveMode, signal: AbortSignal): Promise<CognitionSnapshot>;
}

export interface Settings {
  mode: CognitionMode;
  provider: 'mock' | 'bridge';
  serviceUrl: string;
  candidateLimit: number;
  recentMessageWindow: number;
  timeoutMs: number;
  minimumCallIntervalMs: number;
  injectionDepth: number;
  injectionRole: 'system' | 'assistant' | 'user';
  debugLogging: boolean;
}

export const defaultSettings: Settings = {
  mode: 'OFF', provider: 'mock', serviceUrl: 'http://127.0.0.1:43187/jev/evaluate',
  candidateLimit: 12, recentMessageWindow: 12, timeoutMs: 1500,
  minimumCallIntervalMs: 0, injectionDepth: 0, injectionRole: 'system', debugLogging: false,
};
