/**
 * Cloak Mail Worker
 *
 * Receives inbound email via Cloudflare Email Routing,
 * stores messages in KV, and exposes a REST API for the
 * browser extension to read and delete messages.
 *
 * This worker is deployed automatically by the Cloak agent
 * during setup. It holds no identity data — just raw mail
 * keyed by alias address with a 7-day TTL.
 */

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export default {
  /**
   * Inbound email handler — triggered by Cloudflare Email Routing.
   * Parses the email and stores it in KV.
   */
  async email(message, env) {
    const to = message.to;
    const from = message.from;
    const subject = message.headers.get('subject') || '';

    // Read the raw email body
    const rawBody = await streamToText(message.raw);

    // Extract plain text content from raw email
    const textBody = extractTextBody(rawBody);

    // Try to extract a verification code
    const code = extractCode(textBody);

    // Try to extract a confirmation link
    const link = extractLink(textBody);

    // Build message object
    const msg = {
      id: crypto.randomUUID(),
      from,
      to,
      subject,
      code,
      link,
      body: textBody.slice(0, 5000), // cap stored body at 5KB
      received: new Date().toISOString(),
    };

    // Store in KV keyed by alias address + timestamp
    const key = `inbox:${to}:${msg.id}`;
    await env.CLOAK_KV.put(key, JSON.stringify(msg), {
      expirationTtl: TTL_SECONDS,
    });
  },

  /**
   * HTTP fetch handler — REST API for the browser extension.
   */
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Authenticate
    const secret = request.headers.get('X-Cloak-Auth');
    if (!secret || secret !== env.WORKER_SECRET) {
      return json({ error: 'unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /inbox/:alias — list messages for an alias
    const inboxMatch = path.match(/^\/inbox\/(.+)$/);
    if (request.method === 'GET' && inboxMatch) {
      const alias = decodeURIComponent(inboxMatch[1]);
      const messages = await listMessages(env.CLOAK_KV, alias);
      return json({ messages });
    }

    // DELETE /inbox/:alias — delete all messages for an alias
    if (request.method === 'DELETE' && inboxMatch) {
      const alias = decodeURIComponent(inboxMatch[1]);
      await deleteMessages(env.CLOAK_KV, alias);
      return json({ deleted: true });
    }

    // DELETE /message/:id — delete a single message by key prefix search
    const msgMatch = path.match(/^\/message\/(.+)$/);
    if (request.method === 'DELETE' && msgMatch) {
      const msgId = decodeURIComponent(msgMatch[1]);
      await deleteMessage(env.CLOAK_KV, msgId);
      return json({ deleted: true });
    }

    // GET /health — health check
    if (path === '/health') {
      return json({ status: 'ok' });
    }

    return json({ error: 'not found' }, 404);
  },
};

// --- KV helpers ---

async function listMessages(kv, alias) {
  const prefix = `inbox:${alias}:`;
  const keys = await kv.list({ prefix });
  const messages = [];

  for (const key of keys.keys) {
    const val = await kv.get(key.name);
    if (val) {
      messages.push(JSON.parse(val));
    }
  }

  // Sort newest first
  messages.sort((a, b) => new Date(b.received) - new Date(a.received));
  return messages;
}

async function deleteMessages(kv, alias) {
  const prefix = `inbox:${alias}:`;
  const keys = await kv.list({ prefix });

  for (const key of keys.keys) {
    await kv.delete(key.name);
  }
}

async function deleteMessage(kv, msgId) {
  // Message keys are inbox:<alias>:<id>, so we need to find the full key
  const keys = await kv.list();
  for (const key of keys.keys) {
    if (key.name.endsWith(`:${msgId}`)) {
      await kv.delete(key.name);
      return;
    }
  }
}

// --- Email parsing helpers ---

function extractCode(text) {
  // Match 4-8 digit codes near verification keywords
  const patterns = [
    /(?:code|verify|verification|confirm|pin|otp)[^0-9]*(\d{4,8})/i,
    /(\d{4,8})[^0-9]*(?:is your|verification|confirm)/i,
    /\b(\d{6})\b/,  // fallback: any standalone 6-digit number
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractLink(text) {
  // Match URLs containing verification-related path segments
  const urlPattern = /https?:\/\/[^\s<>"']+(?:verify|confirm|activate|validate|token|auth)[^\s<>"']*/gi;
  const match = text.match(urlPattern);
  if (match) return match[0];

  // Fallback: any URL that looks like a one-time action link
  const fallback = /https?:\/\/[^\s<>"']*[?&](?:token|code|key)=[^\s<>"']*/gi;
  const fallbackMatch = text.match(fallback);
  if (fallbackMatch) return fallbackMatch[0];

  return null;
}

function extractTextBody(raw) {
  // Simple extraction: look for text/plain part or strip HTML tags
  // For MIME multipart, find the text/plain section
  const plainMatch = raw.match(
    /Content-Type:\s*text\/plain[^\r\n]*\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\r?\n)/i
  );
  if (plainMatch) return plainMatch[1].trim();

  // Fallback: strip HTML tags
  const htmlMatch = raw.match(
    /Content-Type:\s*text\/html[^\r\n]*\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\r?\n)/i
  );
  if (htmlMatch) {
    return htmlMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Last resort: return raw content
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function streamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  return result;
}

// --- Response helpers ---

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Cloak-Auth',
  };
}
