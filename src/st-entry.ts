import { makeStHost, type StContext } from './st-host.js';
import { CognitionRuntime } from './runtime.js';
import { MockCognitionProvider, LocalJevBridgeProvider } from './providers.js';
import { parseSettings } from './settings.js';
import { createStUi } from './st-ui.js';
import type { Settings } from './types.js';

interface StAppContext extends StContext {
  eventSource: { on(event: string, listener: (...args: unknown[]) => unknown): void; removeListener(event: string, listener: (...args: unknown[]) => unknown): void };
  eventTypes: Record<string, string>;
  extensionSettings: Record<string, unknown>;
  saveSettingsDebounced(): void;
}
declare global { interface Window { SillyTavern?: { getContext(): StAppContext } } }
const KEY = 'omniaCognition';

function context(): StAppContext | null { try { return window.SillyTavern?.getContext() ?? null; } catch { return null; } }

export async function checkBridge(url: string): Promise<string> {
  const endpoint = new URL(url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || endpoint.protocol !== 'http:' || endpoint.pathname !== '/jev/evaluate') throw new Error('本机桥地址无效');
  endpoint.pathname = '/health';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || (result as Record<string, unknown>).status !== 'running') throw new Error('桥返回格式无效');
    return (result as Record<string, unknown>).jevConfigured ? '本机桥运行中；Jev 密钥已配置。' : '本机桥运行中；Jev 密钥尚未配置。';
  } finally { clearTimeout(timer); }
}

function start(): boolean {
  const st = context();
  if (!st || !document.getElementById('extensions_settings2') && !document.getElementById('extensions_settings')) return false;
  if (document.getElementById('omnia-cognition-settings')) return true;
  const store = st.extensionSettings;
  let settings = parseSettings(store[KEY]);
  const host = makeStHost(context);
  let ui: ReturnType<typeof createStUi>;
  const createRuntime = (value: Settings) => new CognitionRuntime(host, value.provider === 'mock' ? new MockCognitionProvider() : new LocalJevBridgeProvider(value.serviceUrl), value, state => ui?.update(state));
  let runtime = createRuntime(settings);
  ui = createStUi(settings, next => {
    runtime.contextChanged();
    settings = next;
    store[KEY] = settings;
    st.saveSettingsDebounced();
    runtime = createRuntime(settings);
    ui.update(runtime.inspect());
  }, checkBridge);
  ui.update(runtime.inspect());
  const listen = (name: string, callback: (...args: any[]) => unknown) => {
    const event = st.eventTypes[name];
    if (!event) return () => {};
    st.eventSource.on(event, callback);
    return () => st.eventSource.removeListener(event, callback);
  };
  const detach = [
    listen('GENERATION_AFTER_COMMANDS', async (type: string, _options: unknown, dryRun: boolean) => { if (!dryRun) await runtime.generationBeginning(type); }),
    listen('MESSAGE_SENT', async (id: number) => runtime.messageSent(id)),
    listen('GENERATION_ENDED', (id: number) => runtime.generationEnded(id)),
    listen('GENERATION_STOPPED', () => runtime.generationStopped()),
    ...['CHAT_CHANGED', 'CHARACTER_EDITED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED'].map(name => listen(name, () => runtime.contextChanged())),
  ];
  window.addEventListener('pagehide', () => { runtime.contextChanged(); detach.forEach(stop => stop()); ui.dispose(); }, { once: true });
  return true;
}

let attempts = 0;
function bootstrap() {
  try { if (start()) return; }
  catch (error) { console.error('[Omnia Cognition] extension startup failed', error); return; }
  if (++attempts < 20) setTimeout(bootstrap, 300);
  else console.error('[Omnia Cognition] SillyTavern context unavailable');
}
bootstrap();
