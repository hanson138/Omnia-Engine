import { makeHost, type TavernApi } from './host.js';
import { CognitionRuntime } from './runtime.js';
import { MockCognitionProvider, LocalJevBridgeProvider } from './providers.js';
import { parseSettings } from './settings.js';
import { createPanel } from './ui.js';
import type { Settings } from './types.js';

declare const TavernHelper: TavernApi & {
  getVariables(option: { type: 'global' }): Record<string, unknown>;
  replaceVariables(value: Record<string, unknown>, option: { type: 'global' }): void;
};
declare const SillyTavern: { getContext(): { groupId?: string | null; getCurrentChatId(): string | null } };
declare const tavern_events: Record<string, string>;
declare function eventOn(event: string, listener: (...args: any[]) => void | Promise<void>): { stop(): void };

function start() {
  const helper = TavernHelper;
  const api: TavernApi = {
    getChatId: () => SillyTavern.getContext().getCurrentChatId(),
    getGroupId: () => SillyTavern.getContext().groupId ?? null,
    getCurrentCharacterId: () => helper.getCurrentCharacterId(),
    getCurrentCharacterName: () => helper.getCurrentCharacterName(),
    getCharacter: name => helper.getCharacter(name),
    getChatMessages: range => helper.getChatMessages(range),
    getCharWorldbookNames: name => helper.getCharWorldbookNames(name),
    getChatWorldbookName: name => helper.getChatWorldbookName(name),
    getWorldbook: name => helper.getWorldbook(name),
    injectPrompts: (prompts, options) => helper.injectPrompts(prompts, options),
  };
  const host = makeHost(api);
  let settings = parseSettings(helper.getVariables({ type: 'global' }).omniaCognitionSettings);
  let panel: ReturnType<typeof createPanel>;
  function runtimeFor(current: Settings) {
    const provider = current.provider === 'mock' ? new MockCognitionProvider() : new LocalJevBridgeProvider(current.serviceUrl);
    return new CognitionRuntime(host, provider, current, state => panel?.update(state));
  }
  let runtime = runtimeFor(settings);
  panel = createPanel(settings, next => {
    runtime.contextChanged();
    settings = next;
    const variables = helper.getVariables({ type: 'global' });
    helper.replaceVariables({ ...variables, omniaCognitionSettings: settings }, { type: 'global' });
    runtime = runtimeFor(settings);
    panel.update(runtime.inspect());
  });
  panel.update(runtime.inspect());
  const listeners = [
    eventOn(tavern_events.GENERATION_AFTER_COMMANDS!, async (type: string | undefined, _options: unknown, dryRun: boolean) => { if (!dryRun) await runtime.generationBeginning(type); }),
    eventOn(tavern_events.MESSAGE_SENT!, async (messageId: number) => { await runtime.messageSent(messageId); }),
    eventOn(tavern_events.CHAT_CHANGED!, () => runtime.contextChanged()),
    eventOn(tavern_events.CHARACTER_EDITED!, () => runtime.contextChanged()),
    eventOn(tavern_events.GENERATION_ENDED!, (messageId: number) => runtime.generationEnded(messageId)),
    eventOn(tavern_events.GENERATION_STOPPED!, () => runtime.generationStopped()),
  ];
  window.addEventListener('pagehide', () => { runtime.contextChanged(); for (const listener of listeners) listener.stop(); panel.dispose(); }, { once: true });
}

try { start(); } catch (error) { console.error('Omnia cognition script could not start:', error); }
