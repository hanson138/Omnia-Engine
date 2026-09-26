import type { CognitionCandidate } from './types.js';

export interface RetrievalSource {
  character: { id: string; name: string; description: string; personality?: string };
  messages: { id: number; role: 'user' | 'assistant' | 'system'; text: string }[];
  worldbook: { id: string; book: string; content: string; keywords: string[] }[];
  limit: number;
}

export function collectCandidates(source: RetrievalSource): CognitionCandidate[] {
  const limit = Math.max(1, Math.min(20, Math.floor(source.limit)));
  const candidates: CognitionCandidate[] = [];
  const profile = [source.character.description, source.character.personality].filter(Boolean).join(' ').slice(0, 1200);
  if (profile) candidates.push({ id: `card:${source.character.id}`, sourceType: 'card', content: profile, epistemicStatus: 'self_description' });
  const messages = source.messages.filter(message => message.text.trim()).slice(-20);
  const query = messages.slice(-3).map(message => message.text.toLowerCase()).join(' ');
  const matchingWorld = source.worldbook.filter(entry => entry.content.trim() && entry.keywords.some(keyword => keyword.trim() && query.includes(keyword.toLowerCase()))).slice(0, 2);
  const messageSlots = Math.max(0, limit - candidates.length - matchingWorld.length);
  for (const message of messageSlots ? messages.slice(-messageSlots) : []) candidates.push({ id: `message:${message.id}`, sourceType: 'message', content: message.text.slice(0, 500), epistemicStatus: 'utterance', sourceMessageId: message.id, sourceName: message.role });
  for (const entry of matchingWorld) {
    candidates.push({ id: `world:${entry.book}:${entry.id}`, sourceType: 'worldbook', content: entry.content.slice(0, 700), epistemicStatus: 'lore', worldbookEntryId: entry.id, sourceName: entry.book });
  }
  return candidates.slice(0, limit);
}
