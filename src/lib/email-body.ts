import DOMPurify from 'dompurify';
import sanitizeHtmlLib from 'sanitize-html';

let hookInstalled = false;
function ensureHook() {
  if (hookInstalled) return;
  if (typeof window === 'undefined') return;
  if (typeof (DOMPurify as unknown as { addHook?: unknown }).addHook !== 'function') return;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  hookInstalled = true;
}

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

function sanitizeEmailHtml(input: string): string {
  if (typeof window === 'undefined') {
    return sanitizeServer(input);
  }
  ensureHook();
  return DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style'],
    ADD_ATTR: ['target'],
  });
}

export function getSafeEmailHtml(body: string | undefined): string {
  if (!body || !body.trim()) {
    return '<p class="text-muted-foreground italic">No content available</p>';
  }

  const normalized = normalizeNewlines(body);

  if (looksLikeHtml(normalized)) {
    return sanitizeEmailHtml(normalized);
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
