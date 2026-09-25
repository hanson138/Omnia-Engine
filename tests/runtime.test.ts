import { describe, expect, it, vi } from 'vitest';
import { CognitionRuntime, type RuntimeHost } from '../src/runtime.js';
import { MockCognitionProvider } from '../src/providers.js';
import { defaultSettings, type CharacterCognitionProvider, type CharacterCognitionInput, type CognitionSnapshot } from '../src/types.js';

function fixture(provider: CharacterCognitionProvider = new MockCognitionProvider()) {
  let chatId = 'chat-a';
  const inject = vi.fn((_prompt: Parameters<RuntimeHost['inject']>[0], _options: Parameters<RuntimeHost['inject']>[1]) => ({ uninject: vi.fn() }));
  const host: RuntimeHost = {
    getContext: async () => ({ chatId, character: { id: 'bob', name: 'Bob', description: 'Cautious' }, group: false, messages: [{ id: 1, role: 'user', text: 'Where is Alice?' }], worldbook: [] }),
    inject,
  };
  const runtime = new CognitionRuntime(host, provider, { ...defaultSettings, mode: 'COGNITION' });
  return { runtime, inject, switchChat: () => { chatId = 'chat-b'; runtime.contextChanged(); } };
}

describe('runtime', () => {
  it('shows disabled status when it starts in OFF mode', () => {
    const runtime = new CognitionRuntime({ getContext: async () => null, inject: () => { throw Error('must not inject'); } }, new MockCognitionProvider(), defaultSettings);
    expect(runtime.inspect().status).toBe('disabled');
  });
  it('injects one generation-scoped prompt after ordinary user message', async () => {
    const { runtime, inject } = fixture();
    await runtime.generationBeginning('normal');
    await runtime.messageSent(1);
    expect(inject).toHaveBeenCalledOnce();
    expect(inject.mock.calls[0]?.[0].content).toContain('Bob');
    expect(inject.mock.calls[0]?.[1]).toEqual({ once: true });
    runtime.generationEnded();
    expect(runtime.inspect().snapshot?.characterId).toBe('bob');
  });
  it('does nothing in OFF mode', async () => {
    const { runtime, inject } = fixture();
    runtime.setSettings({ ...defaultSettings, mode: 'OFF' });
    await runtime.generationBeginning('normal');
    await runtime.messageSent(1);
    expect(inject).not.toHaveBeenCalled();
  });
  it('discards a result when chat changes while cognition is pending', async () => {
    let complete!: (value: CognitionSnapshot) => void;
    const provider: CharacterCognitionProvider = { evaluate: (input: CharacterCognitionInput) => new Promise(resolve => { complete = value => resolve(value); }) };
    const { runtime, inject, switchChat } = fixture(provider);
    await runtime.generationBeginning('normal');
    const pending = runtime.messageSent(1);
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
    switchChat();
    complete({ requestId: 'old', chatId: 'chat-a', characterId: 'bob', sourceMessageId: 1, salientEvidence: [], providerStatus: 'ok', latencyMs: 0, createdAt: 'now' });
    await pending;
    expect(inject).not.toHaveBeenCalled();
  });
  it('fails open on provider error and group chat', async () => {
    const { runtime, inject } = fixture({ evaluate: async () => { throw new Error('high demand'); } });
    await runtime.generationBeginning('normal');
    await runtime.messageSent(1);
    expect(inject).not.toHaveBeenCalled();
    expect(runtime.inspect().status).toBe('degraded');
  });
  it('cleans up an injected prompt on stop', async () => {
    const { runtime, inject } = fixture();
    await runtime.generationBeginning('normal');
    await runtime.messageSent(1);
    const handle = inject.mock.results[0]?.value;
    runtime.generationStopped();
    expect(handle.uninject).toHaveBeenCalledOnce();
  });
  it('clears private diagnostics when the chat changes', async () => {
    const { runtime, switchChat } = fixture();
    await runtime.generationBeginning('normal'); await runtime.messageSent(1);
    expect(runtime.inspect().injectedText).toContain('Bob');
    switchChat();
    expect(runtime.inspect()).toMatchObject({ status: 'idle', candidates: [] });
    expect(runtime.inspect().injectedText).toBeUndefined();
    expect(runtime.inspect().snapshot).toBeUndefined();
    expect(runtime.inspect().context).toBeUndefined();
  });
  it('times out without injecting when a provider does not settle', async () => {
    const { runtime, inject } = fixture({ evaluate: () => new Promise(() => {}) });
    runtime.setSettings({ ...defaultSettings, mode: 'COGNITION', timeoutMs: 100 });
    await runtime.generationBeginning('normal');
    await runtime.messageSent(1);
    expect(inject).not.toHaveBeenCalled();
    expect(runtime.inspect().timeoutCount).toBe(1);
  });
  it('does not freeze generation when the host context read stalls', async () => {
    const host: RuntimeHost = { getContext: () => new Promise(() => {}), inject: () => { throw Error('must not inject'); } };
    const runtime = new CognitionRuntime(host, new MockCognitionProvider(), { ...defaultSettings, mode: 'COGNITION', timeoutMs: 100 });
    await runtime.generationBeginning('normal');
    await runtime.messageSent(1);
    expect(runtime.inspect().timeoutCount).toBe(1);
    expect(runtime.inspect().status).toBe('degraded');
  });
  it('counts a timeout when fetch rejects immediately on AbortSignal', async () => {
    const { runtime, inject } = fixture({ evaluate: (_input, _mode, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted', 'AbortError')))) });
    runtime.setSettings({ ...defaultSettings, mode: 'COGNITION', timeoutMs: 100 });
    await runtime.generationBeginning('normal'); await runtime.messageSent(1);
    expect(inject).not.toHaveBeenCalled();
    expect(runtime.inspect().timeoutCount).toBe(1);
  });
  it('enters cooldown after repeated overloads', async () => {
    let calls = 0;
    const { runtime } = fixture({ evaluate: async () => { calls++; throw Error('HTTP 429'); } });
    await runtime.generationBeginning('normal'); await runtime.messageSent(1);
    await runtime.generationBeginning('normal'); await runtime.messageSent(1);
    expect(runtime.inspect().status).toBe('cooldown');
    await runtime.generationBeginning('normal'); await runtime.messageSent(1);
    expect(calls).toBe(2);
  });
  it('never requests cognition in a group chat', async () => {
    let calls = 0;
    const host: RuntimeHost = {
      getContext: async () => ({ chatId: 'group', character: { id: 'bob', name: 'Bob', description: '' }, group: true, messages: [], worldbook: [] }),
      inject: () => { throw Error('must not inject'); },
    };
    const runtime = new CognitionRuntime(host, { evaluate: async () => { calls++; throw Error('must not call'); } }, { ...defaultSettings, mode: 'COGNITION' });
    await runtime.generationBeginning('normal'); await runtime.messageSent(1);
    expect(calls).toBe(0);
    expect(runtime.inspect().status).toBe('disabled');
    expect(runtime.inspect().skipReason).toContain('Group chat');
  });
});
