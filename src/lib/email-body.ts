import DOMPurify from 'dompurify';

function decodeHtmlEntities(input: string): string {
  if (typeof document === 'undefined') {
    return input;
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = input;
  return textarea.value;
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

function sanitizeEmailHtml(input: string): string {
  return DOMPurify.sanitize(input, { USE_PROFILES: { html: true } });
}

export function getSafeEmailHtml(body: string | undefined): string {
  if (!body || !body.trim()) {
    return '<p class="text-muted-foreground italic">No content available</p>';
  }

  const decodedBody = decodeHtmlEntities(normalizeNewlines(body));

  if (looksLikeHtml(decodedBody)) {
    return sanitizeEmailHtml(decodedBody);
  }

  return escapeHtml(decodedBody).replace(/\n/g, '<br>');
}

export function getEmailPreviewText(body: string | undefined): string {
  if (!body || !body.trim()) {
    return 'No content preview available';
  }

  const decodedBody = decodeHtmlEntities(normalizeNewlines(body));
  const plainText = looksLikeHtml(decodedBody) ? htmlToText(decodedBody) : decodedBody;

  return plainText.replace(/\n{3,}/g, '\n\n').trim() || 'No content preview available';
}