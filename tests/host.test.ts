import { describe, expect, it, vi } from 'vitest';
import { makeHost, type TavernApi } from '../src/host.js';

describe('TavernHelper host adapter', () => {
  it('reads the active character, current chat and only enabled matching worldbook entries', async () => {
    const api: TavernApi = {
      getChatId: () => 'chat-1', getGroupId: () => null,
      getCurrentCharacterId: () => 'bob.png', getCurrentCharacterName: () => 'Bob',
      getCharacter: async () => ({ description: 'Careful', personality: 'Honest' }),
      getChatMessages: () => [{ message_id: 1, role: 'user', message: 'Where is Alice?', is_hidden: false }],
      getCharWorldbookNames: () => ({ primary: 'town', additional: [] }), getChatWorldbookName: () => null,
      getWorldbook: async () => [{ uid: 3, enabled: true, content: 'Alice lives nearby', strategy: { keys: ['Alice'] } }],
      injectPrompts: vi.fn(() => ({ uninject: vi.fn() })),
    };
    const context = await makeHost(api).getContext();
    expect(context?.chatId).toBe('chat-1');
    expect(context?.character.id).toBe('bob.png');
    expect(context?.worldbook).toEqual([{ id: '3', book: 'town', content: 'Alice lives nearby', keywords: ['Alice'] }]);
  });
});
