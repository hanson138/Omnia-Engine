import type { InspectorState } from './runtime.js';
import type { Settings } from './types.js';
import { parseSettings } from './settings.js';

export function createPanel(settings: Settings, onSettings: (settings: Settings) => void): { update(state: InspectorState): void; dispose(): void } {
  let doc: Document;
  try { doc = parent.document; } catch { return { update() {}, dispose() {} }; }
  const root = doc.createElement('div');
  root.id = 'omnia-cognition-panel';
  root.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:100000;width:300px;max-height:65vh;overflow:auto;padding:10px;background:#20242b;color:#eee;border:1px solid #899;font:12px sans-serif;box-shadow:0 3px 12px #0009';
  const title = doc.createElement('strong'); title.textContent = 'Omnia Cognition · Phase 0'; root.append(title);
  const toggle = doc.createElement('button'); toggle.type = 'button'; toggle.textContent = '展开/收起'; toggle.style.marginLeft = '8px'; root.append(toggle);
  const body = doc.createElement('div'); body.style.display = 'none'; root.append(body);
  toggle.onclick = () => { body.style.display = body.style.display === 'none' ? 'block' : 'none'; };
  const controls: Partial<Record<keyof Settings, HTMLInputElement | HTMLSelectElement>> = {};
  function select(key: keyof Settings, values: string[]) {
    const label = doc.createElement('label'); label.textContent = `${key}: `; label.style.cssText = 'display:block;margin:6px 0';
    const field = doc.createElement('select'); for (const value of values) { const option = doc.createElement('option'); option.value = value; option.textContent = value; field.append(option); }
    field.value = String(settings[key]); controls[key] = field; label.append(field); body.append(label);
    field.onchange = changed;
  }
  function input(key: keyof Settings, type: 'number' | 'text' | 'checkbox') {
    const label = doc.createElement('label'); label.textContent = `${key}: `; label.style.cssText = 'display:block;margin:6px 0';
    const field = doc.createElement('input'); field.type = type; field.style.maxWidth = '165px';
    if (type === 'checkbox') field.checked = Boolean(settings[key]); else field.value = String(settings[key]);
    controls[key] = field; label.append(field); body.append(label); field.onchange = changed;
  }
  select('mode', ['OFF', 'RELEVANCE', 'COGNITION', 'DEBUG']);
  select('provider', ['mock', 'bridge']);
  input('serviceUrl', 'text'); input('candidateLimit', 'number'); input('recentMessageWindow', 'number'); input('timeoutMs', 'number'); input('minimumCallIntervalMs', 'number'); input('injectionDepth', 'number');
  select('injectionRole', ['system', 'assistant', 'user']); input('debugLogging', 'checkbox');
  function changed() {
    const next: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(controls)) next[key] = field.tagName === 'INPUT' && (field as HTMLInputElement).type === 'checkbox' ? (field as HTMLInputElement).checked : field.tagName === 'INPUT' && (field as HTMLInputElement).type === 'number' ? Number(field.value) : field.value;
    settings = parseSettings(next); onSettings(settings);
  }
  const info = doc.createElement('pre'); info.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto'; body.append(info);
  doc.body.append(root);
  return {
    update(state) {
      const summary = [
        `Status: ${state.status}`,
        `Character: ${state.context?.characterName ?? '—'}  Chat: ${state.context?.chatId ?? '—'}`,
        `Latency: ${state.snapshot?.latencyMs ?? '—'} ms`,
        `Errors: ${state.errorCount}  Timeouts: ${state.timeoutCount}  Stale: ${state.staleCount}`,
        `Last error: ${state.lastError ?? '—'}`,
        `Skipped: ${state.skipReason ?? '—'}`,
      ];
      if (settings.mode === 'DEBUG') summary.push(
        `Candidates:\n${state.candidates.map(item => `${item.id} [${item.sourceType}] ${item.content}`).join('\n')}`,
        `Selected: ${state.snapshot?.salientEvidence.map(item => item.candidateId).join(', ') ?? '—'}`,
        `Strategy: ${state.snapshot?.responseTendency?.strategy ?? '—'}`,
        `Injected:\n${state.injectedText ?? '—'}`,
        `Final message ID: ${state.finalMessageId ?? '—'}`,
      );
      info.textContent = summary.join('\n');
    },
    dispose() { root.remove(); },
  };
}
