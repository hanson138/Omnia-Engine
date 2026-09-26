import { createServer, type Server } from 'node:http';
import { z } from 'zod';
import { evaluateWithJev } from './jev.js';
import type { ActiveMode, CharacterCognitionInput, CognitionSnapshot } from '../src/types.js';

const candidate = z.strictObject({ id: z.string().min(1).max(160), sourceType: z.enum(['card', 'message', 'worldbook']), content: z.string().max(1200), epistemicStatus: z.enum(['self_description', 'utterance', 'lore']), sourceMessageId: z.number().int().optional(), worldbookEntryId: z.string().max(160).optional(), sourceName: z.string().max(160).optional() });
const payload = z.strictObject({
  mode: z.enum(['RELEVANCE', 'COGNITION']),
  input: z.strictObject({
    requestId: z.string().min(1).max(160), chatId: z.string().min(1).max(300),
    character: z.strictObject({ id: z.string().min(1).max(160), name: z.string().min(1).max(160), description: z.string().max(1200), personality: z.string().max(1200).optional() }),
    currentSituation: z.strictObject({ latestUserInput: z.string().max(2000), recentDialogue: z.string().max(2500), sourceMessageId: z.number().int() }),
    candidates: z.array(candidate).max(20),
  }),
});

export function createBridgeServer(options: { allowedOrigin: string; evaluate?: (input: CharacterCognitionInput, mode: ActiveMode, signal: AbortSignal) => Promise<CognitionSnapshot> }): Server {
  const evaluate = options.evaluate ?? evaluateWithJev;
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin !== options.allowedOrigin) { response.writeHead(403).end(); return; }
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' }).end(); return; }
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ status: 'running', jevConfigured: Boolean(process.env.AI_GATEWAY_API_KEY) }));
      return;
    }
    if (request.method !== 'POST' || request.url !== '/jev/evaluate') { response.writeHead(404).end(); return; }
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 64_000) { response.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const decoded: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const parsed = payload.safeParse(decoded);
      if (!parsed.success) { response.writeHead(400).end(); return; }
      const controller = new AbortController();
      response.on('close', () => { if (!response.writableEnded) controller.abort('client disconnected'); });
      const result = await evaluate(parsed.data.input, parsed.data.mode, controller.signal);
      if (!response.writableEnded && !response.destroyed) response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result));
    } catch (error) {
      if (response.writableEnded || response.destroyed) return;
      const message = error instanceof Error ? error.message : String(error);
      const status = /high demand|429|overload/i.test(message) ? 429 : /not set|unavailable/i.test(message) ? 503 : 502;
      response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify({ error: status === 429 ? 'high_demand' : 'unavailable' }));
    }
  });
}

if (process.argv[1]?.endsWith('bridge-server.mjs')) {
  const origin = process.env.ST_ALLOWED_ORIGIN ?? 'http://127.0.0.1:8000';
  const port = Number(process.env.OMNIA_BRIDGE_PORT ?? 43187);
  createBridgeServer({ allowedOrigin: origin }).listen(port, '127.0.0.1', () => {
    console.log(`Omnia cognition bridge listening on 127.0.0.1:${port}; allowed origin ${origin}`);
  });
}
