import { describe, expect, it } from 'vitest';
import { collectCandidates } from '../src/retrieval.js';

describe('candidate retrieval', () => {
  it('keeps source IDs and distinguishes a spoken claim from world truth', () => {
    const result = collectCandidates({
      character: { id: 'bob', name: 'Bob', description: 'Cautious' },
      messages: [{ id: 7, role: 'user', text: 'Alice says the basement is empty' }],
      worldbook: [{ id: 'basement', book: 'house', content: 'The basement door is locked', keywords: ['basement'] }],
      limit: 8,
    });
    expect(result.map(item => item.id)).toEqual(['card:bob', 'message:7', 'world:house:basement']);
    expect(result[1]?.epistemicStatus).toBe('utterance');
    expect(result[2]?.epistemicStatus).toBe('lore');
  });

  it('limits candidates and does not include unmatched worldbook entries', () => {
    const result = collectCandidates({
      character: { id: 'bob', name: 'Bob', description: 'Cautious' },
      messages: [{ id: 7, role: 'user', text: 'Where is Alice?' }],
      worldbook: [{ id: 'cellar', book: 'house', content: 'Locked cellar', keywords: ['cellar'] }],
      limit: 2,
    });
    expect(result).toHaveLength(2);
    expect(result.some(item => item.id.startsWith('world:'))).toBe(false);
  });
  it('reserves a slot for matching worldbook evidence when recent chat fills the window', () => {
    const result = collectCandidates({
      character: { id: 'bob', name: 'Bob', description: 'Cautious' },
      messages: Array.from({ length: 12 }, (_, index) => ({ id: index, role: 'user' as const, text: `Basement ${index}` })),
      worldbook: [{ id: 'cellar', book: 'house', content: 'The basement is locked', keywords: ['Basement'] }],
      limit: 8,
    });
    expect(result).toHaveLength(8);
    expect(result.some(item => item.id === 'world:house:cellar')).toBe(true);
  });
});
