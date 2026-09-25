import { describe, expect, it, vi } from 'vitest';
import { makeStHost, type StContext } from '../src/st-host.js';

function context(): StContext {
  const prompts: Record<string, unknown> = {};
  return {
    characterId: 0, groupId: null, name2: 'Alice',
    getCurrentChatId: () => 'chat-a',
    characters: [{ name: 'Alice', data: { description: 'Keeps a secret', personality: 'careful', extensions: { world: 'Cellar' } } }],
    chat: [
      { mes: 'What is downstairs?', is_user: true },
      { mes: 'internal instructions', is_system: true },
      { mes: 'I heard a noise.', is_user: false },
    ],
    chatMetadata: { world_info: 'Village' },
    loadWorldInfo: vi.fn(async name => ({ entries: { 1: { uid: 1, content: `${name} detail`, key: ['basement'], disable: false }, 2: { uid: 2, content: 'hidden', key: ['x'], disable: true } } })),
    setExtensionPrompt: vi.fn((id, value) => { prompts[id] = value; }),
    extensionPrompts: prompts,
  };
}

describe('native SillyTavern host', () => {
  it('maps only visible single-character data and bound books', async () => {
    const st = context();
    const host = makeStHost(() => st);
    const result = await host.getContext();
    expect(result?.character).toMatchObject({ id: '0', name: 'Alice', description: 'Keeps a secret' });
    expect(result?.messages).toEqual([
      { id: 0, role: 'user', text: 'What is downstairs?' },
      { id: 2, role: 'assistant', text: 'I heard a noise.' },
    ]);
    expect(result?.worldbook.map(item => item.book)).toEqual(['Cellar', 'Village']);
    expect(result?.worldbook.every(item => item.keywords.includes('basement'))).toBe(true);
  });

  it('includes active global and additional character books without creating books', async () => {
    const st = context();
    st.executeSlashCommandsWithOptions = vi.fn(async command => ({ pipe: command === '/getglobalbooks' ? '["Eldoria"]' : '["Cellar","Side"]' }));
    const result = await makeStHost(() => st).getContext();
    expect(result?.worldbook.map(item => item.book)).toEqual(['Cellar', 'Village', 'Side', 'Eldoria']);
    expect(st.executeSlashCommandsWithOptions).toHaveBeenCalledWith('/getcharbook type=all');
    expect(st.executeSlashCommandsWithOptions).toHaveBeenCalledWith('/getglobalbooks');
  });

  it('removes a prompt after generation and never reads group member data', async () => {
    const st = context();
    const host = makeStHost(() => st);
    const handle = host.inject({ id: 'omnia-cognition:one', position: 'in_chat', depth: 0, role: 'system', content: 'private' }, { once: true });
    expect(st.extensionPrompts['omnia-cognition:one']).toBe('private');
    handle.uninject();
    expect(st.extensionPrompts['omnia-cognition:one']).toBeUndefined();
    st.groupId = 'group';
    const grouped = await host.getContext();
    expect(grouped?.group).toBe(true);
    expect(grouped?.messages).toEqual([]);
    expect(st.loadWorldInfo).not.toHaveBeenCalled();
  });
});
