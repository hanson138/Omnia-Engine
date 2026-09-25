import type { InspectorState } from './runtime.js';
import { parseSettings } from './settings.js';
import { defaultSettings, type Settings } from './types.js';

type Field = HTMLInputElement | HTMLSelectElement;
const options = {
  mode: ['OFF', 'RELEVANCE', 'COGNITION', 'DEBUG'],
  provider: ['mock', 'bridge'],
  injectionRole: ['system', 'assistant', 'user'],
} as const;

export function createStUi(settings: Settings, onSettings: (next: Settings) => void, checkBridge: (url: string) => Promise<string>, doc: Document = document) {
  const parent = doc.getElementById('extensions_settings2') ?? doc.getElementById('extensions_settings');
  if (!parent) throw new Error('SillyTavern extension settings container is unavailable');
  const root = doc.createElement('section');
  root.id = 'omnia-cognition-settings';
  root.className = 'extension_container oc-root';
  const drawer = doc.createElement('div'); drawer.className = 'inline-drawer'; root.append(drawer);
  const header = doc.createElement('div'); header.className = 'inline-drawer-toggle inline-drawer-header';
  const heading = doc.createElement('b'); heading.textContent = 'Omnia · 角色认知'; header.append(heading);
  const icon = doc.createElement('div'); icon.className = 'inline-drawer-icon fa-solid fa-circle-chevron-down down'; header.append(icon); drawer.append(header);
  const body = doc.createElement('div'); body.className = 'inline-drawer-content oc-body'; drawer.append(body);
  const intro = doc.createElement('p'); intro.textContent = '在 ST 生成对白前选择角色当前最在意的资料。默认关闭；mock 仅验证接线，不代表 Jev 效果。'; body.append(intro);
  const fields = new Map<keyof Settings, Field>();

  function row(key: keyof Settings, labelText: string, help: string, kind: 'select' | 'number' | 'text' | 'checkbox', values?: readonly string[]) {
    const label = doc.createElement('label'); label.className = 'oc-row';
    const title = doc.createElement('span'); title.textContent = labelText; label.append(title);
    const field = kind === 'select' ? doc.createElement('select') : doc.createElement('input');
    if (field instanceof HTMLInputElement) field.type = kind;
    if (field instanceof HTMLSelectElement) for (const value of values ?? []) { const option = doc.createElement('option'); option.value = value; option.textContent = value; field.append(option); }
    field.setAttribute('aria-label', labelText); fields.set(key, field); label.append(field); body.append(label);
    const hint = doc.createElement('small'); hint.className = 'oc-hint'; hint.textContent = help; body.append(hint);
    field.addEventListener('change', () => {
      const raw: Record<string, unknown> = {};
      for (const [name, item] of fields) raw[name] = item instanceof HTMLInputElement && item.type === 'checkbox' ? item.checked : item instanceof HTMLInputElement && item.type === 'number' ? Number(item.value) : item.value;
      const next = parseSettings(raw); apply(next); onSettings(next);
    });
  }

  row('mode', '运行模式', 'OFF 不请求也不注入；DEBUG 显示原始候选。', 'select', options.mode);
  row('provider', '认知提供者', 'mock 用于验收；bridge 调用本机 Jev 桥。', 'select', options.provider);
  row('serviceUrl', '本机桥地址', '只允许 localhost / 127.0.0.1 的 /jev/evaluate。密钥仅在桥进程配置。', 'text');
  const actions = doc.createElement('div'); actions.className = 'oc-actions'; body.append(actions);
  const probe = doc.createElement('button'); probe.type = 'button'; probe.textContent = '检查本机桥'; actions.append(probe);
  const reset = doc.createElement('button'); reset.type = 'button'; reset.textContent = '恢复默认'; actions.append(reset);
  const bridgeStatus = doc.createElement('div'); bridgeStatus.className = 'oc-hint'; bridgeStatus.setAttribute('aria-live', 'polite'); body.append(bridgeStatus);
  probe.addEventListener('click', async () => { probe.disabled = true; bridgeStatus.textContent = '正在检查…'; try { bridgeStatus.textContent = await checkBridge(settings.serviceUrl); } catch (error) { bridgeStatus.textContent = `连接失败：${error instanceof Error ? error.message : String(error)}`; } finally { probe.disabled = false; } });
  reset.addEventListener('click', () => { apply(defaultSettings); onSettings(defaultSettings); bridgeStatus.textContent = ''; });

  const advanced = doc.createElement('details'); const advancedTitle = doc.createElement('summary'); advancedTitle.textContent = '高级设置'; advanced.append(advancedTitle); body.append(advanced);
  const previousBody = body;
  // Move the controls made below into the advanced section after creation.
  const advancedStart = body.childNodes.length;
  row('candidateLimit', '候选上限', '每轮最多送给 Jev 的证据数量。', 'number');
  row('recentMessageWindow', '近期消息', '检索最近多少条可见消息。', 'number');
  row('timeoutMs', 'Jev 超时（毫秒）', '超时后 ST 正常继续生成。', 'number');
  row('minimumCallIntervalMs', '最小调用间隔（毫秒）', '减轻连续生成时的调用频率。', 'number');
  row('injectionDepth', '注入深度', '0 为靠近最新消息；可用于位置对照试验。', 'number');
  row('injectionRole', '注入角色', '默认为 system；调整后应做同场景比较。', 'select', options.injectionRole);
  row('debugLogging', '控制台调试日志', '只打印 ID、状态和延迟，不打印密钥。', 'checkbox');
  while (previousBody.childNodes.length > advancedStart) advanced.append(previousBody.childNodes[advancedStart]!);

  const status = doc.createElement('div'); status.className = 'oc-status'; status.setAttribute('aria-live', 'polite'); body.append(status);
  const detail = doc.createElement('details'); const detailTitle = doc.createElement('summary'); detailTitle.textContent = '本轮诊断'; detail.append(detailTitle);
  const log = doc.createElement('pre'); log.className = 'oc-log'; detail.append(log); body.append(detail);
  const apply = (next: Settings) => {
    settings = next;
    for (const [key, field] of fields) {
      if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = Boolean(next[key]);
      else field.value = String(next[key]);
    }
  };
  apply(settings);
  parent.append(root);
  return {
    update(state: InspectorState) {
      status.textContent = `状态：${state.status} ｜ 角色：${state.context?.characterName ?? '—'} ｜ Jev：${state.snapshot?.latencyMs ?? '—'} ms`;
      const lines = [
        `Chat: ${state.context?.chatId ?? '—'}`,
        `Errors: ${state.errorCount}  Timeouts: ${state.timeoutCount}  Stale: ${state.staleCount}`,
        `Last error: ${state.lastError ?? '—'}`,
        `Skipped: ${state.skipReason ?? '—'}`,
        `Selected IDs: ${state.snapshot?.salientEvidence.map(item => item.candidateId).join(', ') ?? '—'}`,
        `Strategy: ${state.snapshot?.responseTendency?.strategy ?? '—'}`,
        `Final message ID: ${state.finalMessageId ?? '—'}`,
      ];
      if (settings.mode === 'DEBUG') lines.push(
        `Candidates:\n${state.candidates.map(item => `${item.id} [${item.sourceType}] ${item.content}`).join('\n')}`,
        `Injected:\n${state.injectedText ?? '—'}`,
      );
      log.textContent = lines.join('\n');
    },
    dispose() { root.remove(); },
  };
}
