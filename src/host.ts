import type { RuntimeHost, HostContext } from './runtime.js';
import type { Settings } from './types.js';

export interface TavernApi {
  getChatId(): string | null;
  getGroupId(): string | null;
  getCurrentCharacterId(): string | null;
  getCurrentCharacterName(): string | null;
  getCharacter(name: 'current'): Promise<{ description?: string; personality?: string }>;
  getChatMessages(range: string): { message_id: number; role: 'user' | 'assistant' | 'system'; message: string; is_hidden: boolean }[];
  getCharWorldbookNames(name: 'current'): { primary: string | null; additional: string[] };
  getChatWorldbookName(name: 'current'): string | null;
  getWorldbook(name: string): Promise<{ uid: number; enabled: boolean; content: string; strategy: { keys: (string | RegExp)[] } }[]>;
  injectPrompts(prompts: { id: string; position: 'in_chat'; depth: number; role: Settings['injectionRole']; content: string }[], options: { once: true }): { uninject(): void };
}

export function makeHost(api: TavernApi): RuntimeHost {
  return {
    async getContext(): Promise<HostContext | null> {
      const chatId = api.getChatId();
      const id = api.getCurrentCharacterId();
      const name = api.getCurrentCharacterName();
      if (!chatId || !id || !name) return null;
      const group = Boolean(api.getGroupId());
      if (group) return { chatId, group, character: { id, name, description: '' }, messages: [], worldbook: [] };
      const [character, messages] = await Promise.all([
        api.getCharacter('current'), Promise.resolve(api.getChatMessages('0-{{lastMessageId}}')),
      ]);
      const names = api.getCharWorldbookNames('current');
      const bookNames = [...new Set([names.primary, ...names.additional, api.getChatWorldbookName('current')].filter((value): value is string => Boolean(value)))].slice(0, 4);
      const worldbook = (await Promise.all(bookNames.map(async book => {
        try {
          const entries = await api.getWorldbook(book);
          return entries.filter(entry => entry.enabled).slice(0, 50).map(entry => ({
            id: String(entry.uid), book, content: entry.content,
            keywords: entry.strategy.keys.filter((key): key is string => typeof key === 'string'),
          }));
        } catch { return []; }
      }))).flat();
      return {
        chatId, group, character: { id, name, description: character.description ?? '', personality: character.personality ?? '' },
        messages: messages.filter(message => !message.is_hidden).map(message => ({ id: message.message_id, role: message.role, text: message.message })),
        worldbook,
      };
    },
    inject(prompt, options) { return api.injectPrompts([prompt], options); },
  };
}
