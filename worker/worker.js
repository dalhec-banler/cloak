/**
 * Cloak Mail Worker
 *
 * Receives inbound email via Cloudflare Email Routing,
 * stores messages in KV, and exposes a REST API for the
 * browser extension to read and delete messages.
 *
 * Deployed as "cloak-mail". Holds no identity data — just
 * raw mail keyed by alias address with a 7-day TTL.
 */

const TTL_SECONDS = 7 * 24 * 60 * 60;

export default {
  /**
   * Inbound email handler — triggered by Cloudflare Email Routing.
   */
  async email(message, env) {
    const to = message.to;
    const from = message.from;
    const subject = message.headers.get('subject') || '';

    const rawBody = await streamToText(message.raw);
    const textBody = extractTextBody(rawBody);

    // Check subject first, then body for codes and links
    const combined = subject + '\n' + textBody;
    const code = extractCode(combined);
    const link = extractLink(combined);

    const msg = {
      id: crypto.randomUUID(),
      from,
      to,
      subject,
      code,
      link,
      body: textBody.slice(0, 5000),
      received: new Date().toISOString(),
    };

    const key = `inbox:${to}:${msg.id}`;
    await env.CLOAK_KV.put(key, JSON.stringify(msg), {
      expirationTtl: TTL_SECONDS,
    });
  },

  /**
   * HTTP fetch handler — REST API for the browser extension.
   */
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const secret = request.headers.get('X-Cloak-Auth');
    if (!secret || secret !== env.WORKER_SECRET) {
      return json({ error: 'unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /inbox/:alias
    const inboxMatch = path.match(/^\/inbox\/(.+)$/);
    if (request.method === 'GET' && inboxMatch) {
      const alias = decodeURIComponent(inboxMatch[1]);
      const messages = await listMessages(env.CLOAK_KV, alias);
      return json({ messages });
    }

    // DELETE /inbox/:alias
    if (request.method === 'DELETE' && inboxMatch) {
      const alias = decodeURIComponent(inboxMatch[1]);
      await deleteMessages(env.CLOAK_KV, alias);
      return json({ deleted: true });
    }

    // DELETE /message/:id
    const msgMatch = path.match(/^\/message\/(.+)$/);
    if (request.method === 'DELETE' && msgMatch) {
      const msgId = decodeURIComponent(msgMatch[1]);
      await deleteMessage(env.CLOAK_KV, msgId);
      return json({ deleted: true });
    }

    // GET /health
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
  const prefix = `inbox:`;
  const keys = await kv.list({ prefix });
  for (const key of keys.keys) {
    if (key.name.endsWith(`:${msgId}`)) {
      await kv.delete(key.name);
      return;
    }
  }
}

// --- MIME parsing ---

function extractTextBody(raw) {
  const parts = extractMimeParts(raw);

  // Prefer text/plain, fall back to text/html
  const part =
    parts.find((p) => p.type === 'text/plain') ||
    parts.find((p) => p.type === 'text/html');

  if (!part) {
    // Non-MIME: body is everything after the header block
    const sep = raw.indexOf('\r\n\r\n');
    const sep2 = raw.indexOf('\n\n');
    const idx = sep >= 0 ? sep + 4 : sep2 >= 0 ? sep2 + 2 : 0;
    return stripHtml(raw.slice(idx));
  }

  let body = part.body;

  if (part.encoding === 'base64') {
    body = decodeBase64(body);
  } else if (part.encoding === 'quoted-printable') {
    body = decodeQuotedPrintable(body);
  }

  if (part.type === 'text/html') {
    body = stripHtml(body);
  }

  return body.trim();
}

function extractMimeParts(raw) {
  const parts = [];

  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) {
    // Single-part email — extract from top-level headers
    const headerEnd = findHeaderEnd(raw);
    if (headerEnd < 0) return parts;

    const headers = raw.slice(0, headerEnd);
    const body = raw.slice(headerEnd + gapSize(raw, headerEnd));

    parts.push({
      type: getHeaderValue(headers, 'content-type') || 'text/plain',
      encoding: getHeaderValue(headers, 'content-transfer-encoding') || '7bit',
      body,
    });

    return parts;
  }

  const boundary = boundaryMatch[1];
  const sections = raw.split('--' + boundary);

  for (const section of sections) {
    if (section.startsWith('--') || section.trim() === '') continue;

    const headerEnd = findHeaderEnd(section);
    if (headerEnd < 0) continue;

    const headers = section.slice(0, headerEnd);
    const body = section.slice(headerEnd + gapSize(section, headerEnd));

    const contentType = getHeaderValue(headers, 'content-type') || 'text/plain';

    // Recurse into nested multipart
    if (contentType.startsWith('multipart/')) {
      parts.push(...extractMimeParts(section));
    } else {
      parts.push({
        type: contentType,
        encoding:
          getHeaderValue(headers, 'content-transfer-encoding') || '7bit',
        body,
      });
    }
  }

  return parts;
}

function findHeaderEnd(str) {
  const crlf = str.indexOf('\r\n\r\n');
  const lf = str.indexOf('\n\n');
  if (crlf >= 0 && (lf < 0 || crlf < lf)) return crlf;
  return lf;
}

function gapSize(str, idx) {
  return str[idx] === '\r' ? 4 : 2;
}

function getHeaderValue(headers, name) {
  const re = new RegExp(`^${name}:\\s*([^\\r\\n;]+)`, 'im');
  const m = headers.match(re);
  return m ? m[1].trim().toLowerCase() : null;
}

// --- Encoding helpers ---

function decodeBase64(str) {
  try {
    const cleaned = str.replace(/[\r\n\s]/g, '');
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return str;
  }
}

function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, '') // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function stripHtml(str) {
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// --- Code / link extraction ---

function extractCode(text) {
  const patterns = [
    // "your code is 123456", "code: 123456", "OTP: 1234"
    /(?:code|verify|verification|confirm|pin|otp|passcode)\s*(?:is|:)?\s*(\d{4,8})/i,
    // "123456 is your code"
    /(\d{4,8})\s+(?:is your|is the)\s+(?:code|verification|otp|pin)/i,
    // Standalone 6-digit number on its own line (common format)
    /^\s*(\d{6})\s*$/m,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractLink(text) {
  // URLs containing verification-related path segments
  const primary =
    /https?:\/\/[^\s<>"']+(?:verify|confirm|activate|validate|auth)[^\s<>"']*/gi;
  const match = text.match(primary);
  if (match) return cleanUrl(match[0]);

  // Fallback: URL with token/code/key query param
  const fallback =
    /https?:\/\/[^\s<>"']*[?&](?:token|code|key|confirmation)=[^\s<>"']*/gi;
  const fbMatch = text.match(fallback);
  if (fbMatch) return cleanUrl(fbMatch[0]);

  return null;
}

function cleanUrl(url) {
  // Trim trailing punctuation that got swept into the regex
  return url.replace(/[.,;)}\]]+$/, '');
}

// --- Stream / response helpers ---

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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Cloak-Auth',
  };
}
