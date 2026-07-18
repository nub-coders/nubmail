import sanitizeHtmlLib from 'sanitize-html';

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n?/g, '\n');
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function textToSafeHtml(input: string): string {
  return escapeHtml(input).replace(/\n/g, '<br>');
}

// Sanitizer for outbound mail we compose/relay. Wider allowlist than the
// inbound reader (tables, headings, inline styles) since the operator is the
// author, but still strips scripts and non-http(s)/mailto/data URLs.
export function sanitizeOutboundHtml(input: string): string {
  return sanitizeHtmlLib(input, {
    allowedTags: [
      ...sanitizeHtmlLib.defaults.allowedTags,
      'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'span',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
    ],
    allowedAttributes: {
      ...sanitizeHtmlLib.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height'],
      '*': ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  });
}

function looksLikeHtml(input: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

function htmlToText(input: string): string {
  return input
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|pre|table)\s*>/gi, '\n')
    .replace(/<(tr|li)\b[^>]*>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '');
}

function sanitizeServer(input: string): string {
  return sanitizeHtmlLib(input, {
    allowedTags: sanitizeHtmlLib.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtmlLib.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
    },
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
    disallowedTagsMode: 'discard',
  });
}

export function getSafeEmailHtml(body: string | undefined): string {
  if (!body || !body.trim()) {
    return '<p class="text-muted-foreground italic">No content available</p>';
  }

  const normalized = normalizeNewlines(body);

  if (looksLikeHtml(normalized)) {
    return sanitizeServer(normalized);
  }

  return escapeHtml(normalized).replace(/\n/g, '<br>');
}

export function getEmailPreviewText(body: string | undefined): string {
  if (!body || !body.trim()) {
    return 'No content preview available';
  }

  const normalized = normalizeNewlines(body);
  const plainText = looksLikeHtml(normalized) ? htmlToText(normalized) : normalized;

  return plainText.replace(/\n{3,}/g, '\n\n').trim() || 'No content preview available';
}
