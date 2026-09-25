import { defaultSettings, type Settings } from './types.js';

export function parseSettings(value: unknown): Settings {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const choice = <T extends string>(key: string, options: readonly T[], fallback: T): T => options.includes(source[key] as T) ? source[key] as T : fallback;
  const number = (key: string, low: number, high: number, fallback: number): number => typeof source[key] === 'number' && Number.isFinite(source[key]) ? Math.max(low, Math.min(high, Math.floor(source[key]))) : fallback;
  let serviceUrl = defaultSettings.serviceUrl;
  try {
    if (typeof source.serviceUrl === 'string') {
      const candidate = new URL(source.serviceUrl);
      if (candidate.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(candidate.hostname) && candidate.pathname === '/jev/evaluate') serviceUrl = candidate.href;
    }
  } catch { /* invalid local URL */ }
  return {
    mode: choice('mode', ['OFF', 'RELEVANCE', 'COGNITION', 'DEBUG'], defaultSettings.mode),
    provider: choice('provider', ['mock', 'bridge'], defaultSettings.provider), serviceUrl,
    candidateLimit: number('candidateLimit', 1, 20, defaultSettings.candidateLimit),
    recentMessageWindow: number('recentMessageWindow', 1, 30, defaultSettings.recentMessageWindow),
    timeoutMs: number('timeoutMs', 100, 10_000, defaultSettings.timeoutMs),
    minimumCallIntervalMs: number('minimumCallIntervalMs', 0, 60_000, defaultSettings.minimumCallIntervalMs),
    injectionDepth: number('injectionDepth', 0, 20, defaultSettings.injectionDepth),
    injectionRole: choice('injectionRole', ['system', 'assistant', 'user'], defaultSettings.injectionRole),
    debugLogging: source.debugLogging === true,
  };
}
