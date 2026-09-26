import { createServer } from 'node:http';

// Local-only integration fixture. It records prompt-marker presence, never message text.
const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/v1/models') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ data: [{ id: 'omnia-live-stub', object: 'model' }] }));
    return;
  }
  if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
    response.writeHead(404).end();
    return;
  }
  let body = '';
  for await (const chunk of request) body += chunk;
  let payload;
  try { payload = JSON.parse(body); }
  catch { response.writeHead(400).end(); return; }
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const cognition = messages.filter(message => JSON.stringify(message).includes('<omnia_character_cognition>'));
  console.log(JSON.stringify({ event: 'completion', model: payload.model, stream: Boolean(payload.stream), messages: messages.length, cognitionBlocks: cognition.length }));
  const answer = 'I hear you. Let us take this one step at a time.';
  if (payload.stream) {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    response.write(`data: ${JSON.stringify({ id: 'stub', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: answer }, finish_reason: null }] })}\n\n`);
    response.write(`data: ${JSON.stringify({ id: 'stub', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
    response.end('data: [DONE]\n\n');
  } else {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ id: 'stub', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: answer }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  }
});
server.listen(43200, '127.0.0.1', () => console.log('Local test endpoint: http://127.0.0.1:43200/v1'));
