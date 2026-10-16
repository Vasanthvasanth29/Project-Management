import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
  'ul', 'ol', 'li', 'a', 'span', 'mark', 'h1', 'h2', 'h3',
  'blockquote',
];

const ALLOWED_ATTRS = [
  'href', 'target', 'rel', 'style', 'class',
];

const ALLOWED_STYLES: Record<string, string[]> = {
  'color': [],
  'background-color': [],
};

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
  }) as string;
}

export function isEmptyHtml(html: string): boolean {
  const stripped = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return stripped.length === 0;
}
