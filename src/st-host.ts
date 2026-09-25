import type { RuntimeHost, HostContext } from './runtime.js';

interface StCharacter {
  name?: string;
  data?: { description?: string; personality?: string; extensions?: { world?: string } };
  description?: string;
  personality?: string;
}
interface StMessage { mes?: string; is_user?: boolean; is_system?: boolean }
interface StWorldEntry { uid?: number; content?: string; key?: string | string[]; disable?: boolean }

export interface StContext {
  characterId: string | number | null;
  groupId: string | null;
  name2?: string;
  getCurrentChatId(): string | null;
  characters: StCharacter[];
  chat: StMessage[];
  chatMetadata?: { world_info?: string };
  loadWorldInfo(name: string): Promise<{ entries: Record<string, StWorldEntry> } | null | undefined>;
  executeSlashCommandsWithOptions?(command: string): Promise<{ pipe?: string; isError?: boolean }>;
  setExtensionPrompt(id: string, value: string, position: number, depth: number, scan: boolean, role: number): void;
  extensionPrompts: Record<string, unknown>;
}

export function makeStHost(getStContext: () => StContext | null): RuntimeHost {
  return {
    async getContext(): Promise<HostContext | null> {
      const st = getStContext();
      const chatId = st?.getCurrentChatId();
      if (!st || !chatId) return null;
      if (st.groupId) return { chatId, group: true, character: { id: 'group', name: 'Group chat', description: '' }, messages: [], worldbook: [] };
      if (st.characterId === null) return null;
      const character = st.characters[Number(st.characterId)];
      if (!character) return null;
      async function readBookNames(command: string): Promise<string[]> {
        if (!st?.executeSlashCommandsWithOptions) return [];
        try {
          const result = await st.executeSlashCommandsWithOptions(command);
          if (result.isError) return [];
          const names: unknown = JSON.parse(result.pipe ?? '[]');
          return Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string' && name.length > 0 && name.length <= 160) : [];
        } catch { return []; }
      }
      const characterBooks = await readBookNames('/getcharbook type=all');
      const globalBooks = await readBookNames('/getglobalbooks');
      const names = [...new Set([character.data?.extensions?.world, st.chatMetadata?.world_info, ...characterBooks, ...globalBooks].filter((name): name is string => Boolean(name)))].slice(0, 4);
      const worldbook = (await Promise.all(names.map(async book => {
        try {
          const data = await st.loadWorldInfo(book);
          return Object.entries(data?.entries ?? {}).slice(0, 50).flatMap(([id, entry]) => {
            if (entry.disable || !entry.content?.trim()) return [];
            const raw = Array.isArray(entry.key) ? entry.key : entry.key ? [entry.key] : [];
            return [{ id, book, content: entry.content, keywords: raw.flatMap(key => key.split(',').map(word => word.trim()).filter(Boolean)) }];
          });
        } catch { return []; }
      }))).flat();
      return {
        chatId, group: false,
        character: {
          id: String(st.characterId), name: character.name || st.name2 || 'Character',
          description: character.data?.description ?? character.description ?? '',
          personality: character.data?.personality ?? character.personality ?? '',
        },
        messages: st.chat.flatMap((message, id) => message.is_system || !message.mes?.trim() ? [] : [{ id, role: message.is_user ? 'user' as const : 'assistant' as const, text: message.mes }]),
        worldbook,
      };
    },
    inject(prompt) {
      const st = getStContext();
      if (!st) throw new Error('SillyTavern context unavailable');
      const roles = { system: 0, user: 1, assistant: 2 } as const;
      st.setExtensionPrompt(prompt.id, prompt.content, 1, prompt.depth, false, roles[prompt.role]);
      return { uninject() { delete st.extensionPrompts[prompt.id]; } };
    },
  };
}
