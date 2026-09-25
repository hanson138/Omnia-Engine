import { collectCandidates, type RetrievalSource } from './retrieval.js';
import { formatCognition } from './prompt.js';
import { validateSnapshot } from './providers.js';
import type { CharacterCognitionInput, CharacterCognitionProvider, CognitionCandidate, CognitionSnapshot, Settings } from './types.js';

export interface HostContext extends Omit<RetrievalSource, 'limit'> {
  chatId: string;
  group: boolean;
}
export interface RuntimeHost {
  getContext(): Promise<HostContext | null>;
  inject(prompt: { id: string; position: 'in_chat'; depth: number; role: Settings['injectionRole']; content: string }, options: { once: true }): { uninject(): void };
}
export interface InspectorState {
  status: 'idle' | 'healthy' | 'degraded' | 'cooldown' | 'disabled';
  context?: { chatId: string; characterId: string; characterName: string };
  candidates: CognitionCandidate[];
  snapshot?: CognitionSnapshot;
  injectedText?: string;
  lastError?: string;
  skipReason?: string;
  finalMessageId?: number;
  staleCount: number;
  errorCount: number;
  timeoutCount: number;
}

export class CognitionRuntime {
  private epoch = 0;
  private active = false;
  private controller?: AbortController;
  private injected?: { uninject(): void };
  private lastCallAt = 0;
  private overloads = 0;
  private cooldownUntil = 0;
  private sequence = 0;
  private state: InspectorState = { status: 'idle', candidates: [], staleCount: 0, errorCount: 0, timeoutCount: 0 };

  constructor(private readonly host: RuntimeHost, private readonly provider: CharacterCognitionProvider, private settings: Settings, private readonly onChange: (state: InspectorState) => void = () => {}) {}

  setSettings(settings: Settings): void {
    this.settings = settings;
    if (settings.mode === 'OFF') {
      this.contextChanged();
      this.state.status = 'disabled';
      this.publish();
    }
  }
  inspect(): InspectorState { return structuredClone(this.state); }

  async generationBeginning(type: string | undefined): Promise<void> {
    this.contextChanged();
    this.active = true;
    if (type && !['normal', 'quiet', 'impersonate'].includes(type)) await this.evaluateCurrent();
  }

  async messageSent(messageId: number): Promise<void> {
    if (this.active) await this.evaluateCurrent(messageId);
  }

  generationEnded(messageId?: number): void {
    if (messageId !== undefined) this.state.finalMessageId = messageId;
    this.contextChanged();
    this.publish();
  }
  generationStopped(): void { this.contextChanged(); }
  contextChanged(): void {
    this.epoch++;
    this.active = false;
    this.controller?.abort('context changed');
    this.controller = undefined;
    this.injected?.uninject();
    this.injected = undefined;
  }

  private async evaluateCurrent(expectedMessageId?: number): Promise<void> {
    if (this.settings.mode === 'OFF' || !this.active) return;
    const epoch = this.epoch;
    let context: HostContext | null;
    try { context = await this.host.getContext(); }
    catch (error) { this.fail(error); return; }
    if (!context || epoch !== this.epoch) return;
    if (context.group) {
      this.state.status = 'disabled';
      this.state.skipReason = 'Group chat is not supported in Phase 0';
      this.publish();
      return;
    }
    if (!context.character.id) return;
    this.state.skipReason = undefined;
    const last = context.messages.at(-1);
    if (expectedMessageId !== undefined && last?.id !== expectedMessageId) return;
    if (Date.now() < this.cooldownUntil) { this.state.status = 'cooldown'; this.publish(); return; }
    if (Date.now() - this.lastCallAt < this.settings.minimumCallIntervalMs) return;
    this.lastCallAt = Date.now();
    this.controller?.abort('superseded');
    const controller = new AbortController();
    this.controller = controller;
    const requestId = `omnia-${++this.sequence}`;
    const input: CharacterCognitionInput = {
      requestId, chatId: context.chatId, character: context.character,
      currentSituation: {
        latestUserInput: [...context.messages].reverse().find(message => message.role === 'user')?.text ?? '',
        recentDialogue: context.messages.slice(-this.settings.recentMessageWindow).map(message => `${message.role}: ${message.text}`).join('\n').slice(-2400),
        sourceMessageId: last?.id ?? -1,
      },
      candidates: collectCandidates({ ...context, messages: context.messages.slice(-this.settings.recentMessageWindow), limit: this.settings.candidateLimit }),
    };
    this.state.context = { chatId: context.chatId, characterId: context.character.id, characterName: context.character.name };
    this.state.candidates = input.candidates;
    this.state.snapshot = undefined;
    this.state.injectedText = undefined;
    this.publish();
    const mode = this.settings.mode === 'RELEVANCE' ? 'RELEVANCE' : 'COGNITION';
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { timedOut = true; controller.abort('timeout'); reject(new Error('timeout')); }, this.settings.timeoutMs); });
      const result = await Promise.race([this.provider.evaluate(input, mode, controller.signal), timeout]);
      if (epoch !== this.epoch || !this.active || controller.signal.aborted) { this.state.staleCount++; this.publish(); return; }
      const now = await this.host.getContext();
      if (!now || now.chatId !== input.chatId || now.character.id !== input.character.id || now.messages.at(-1)?.id !== input.currentSituation.sourceMessageId) { this.state.staleCount++; this.publish(); return; }
      if (!validateSnapshot(result, input, mode)) throw new Error('invalid cognition snapshot');
      const content = formatCognition(input, result);
      this.injected?.uninject();
      this.injected = this.host.inject({ id: `omnia-cognition:${encodeURIComponent(input.chatId)}:${encodeURIComponent(input.character.id)}:${requestId}`, position: 'in_chat', depth: this.settings.injectionDepth, role: this.settings.injectionRole, content }, { once: true });
      this.state.snapshot = result;
      this.state.injectedText = content;
      this.state.status = 'healthy';
      this.state.lastError = undefined;
      this.overloads = 0;
      this.publish();
    } catch (error) {
      if (epoch === this.epoch && this.active) this.fail(timedOut ? new Error('timeout') : error);
    } finally { if (timer) clearTimeout(timer); }
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.state.lastError = message;
    this.state.errorCount++;
    if (/timeout/i.test(message)) this.state.timeoutCount++;
    if (/429|high demand|overload/i.test(message)) {
      this.overloads++;
      if (this.overloads >= 2) this.cooldownUntil = Date.now() + 30_000;
    }
    this.state.status = Date.now() < this.cooldownUntil ? 'cooldown' : 'degraded';
    this.publish();
  }
  private publish(): void {
    if (this.settings.debugLogging) console.debug('[omnia-cognition]', {
      status: this.state.status, candidateIds: this.state.candidates.map(item => item.id),
      selectedIds: this.state.snapshot?.salientEvidence.map(item => item.candidateId) ?? [],
      strategy: this.state.snapshot?.responseTendency?.strategy, latencyMs: this.state.snapshot?.latencyMs,
      error: this.state.lastError,
    });
    this.onChange(this.inspect());
  }
}
