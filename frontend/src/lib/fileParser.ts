export interface FileBlock {
  id: string;
  name: string;
  type: string;
  content: string;
  isStreaming: boolean;
}

export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'file'; file: FileBlock };

/**
 * Extracts attribute values like name="..." or type="..." from a tag string.
 */
function getAttr(tag: string, attr: string): string {
  const match = tag.match(new RegExp(`${attr}=(?:["']([^"']*)["']|([^\\s>]+))`, 'i'));
  return match ? (match[1] || match[2] || '') : '';
}

/**
 * Infers file type from filename extension if not explicitly specified.
 */
function inferType(name: string, explicitType?: string): string {
  if (explicitType && explicitType.trim()) {
    return explicitType.trim().toLowerCase();
  }
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return 'txt';
  if (ext === 'htm' || ext === 'html') return 'html';
  if (ext === 'js' || ext === 'javascript' || ext === 'mjs' || ext === 'cjs') return 'js';
  if (ext === 'ts' || ext === 'typescript') return 'ts';
  if (ext === 'jsx' || ext === 'tsx') return ext;
  if (ext === 'css' || ext === 'scss' || ext === 'sass') return 'css';
  if (ext === 'json') return 'json';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'py' || ext === 'python') return 'py';
  if (ext === 'svg') return 'svg';
  if (ext === 'sql') return 'sql';
  if (ext === 'sh' || ext === 'bash') return 'sh';
  return ext;
}

/**
 * Parses a string (streaming or completed) into an ordered list of text and file segments.
 */
export function parseFileSegments(rawText: string, isMessageStreaming = false): MessageSegment[] {
  if (!rawText) return [];

  const segments: MessageSegment[] = [];
  const openTagRegex = /<chaty-file\b([^>]*)>/gi;
  const closeTag = '</chaty-file>';

  let cursor = 0;
  let fileIndex = 0;

  while (cursor < rawText.length) {
    openTagRegex.lastIndex = cursor;
    const openMatch = openTagRegex.exec(rawText);

    if (!openMatch) {
      // Check if there is an incomplete opening tag at the very end (e.g. "<chaty-file name=...")
      const partialOpenIndex = rawText.indexOf('<chaty-file', cursor);
      if (partialOpenIndex !== -1) {
        const textBefore = rawText.slice(cursor, partialOpenIndex);
        if (textBefore) {
          segments.push({ type: 'text', content: textBefore });
        }
        const partialTag = rawText.slice(partialOpenIndex);
        const name = getAttr(partialTag, 'name') || 'artifact.txt';
        const type = inferType(name, getAttr(partialTag, 'type'));
        segments.push({
          type: 'file',
          file: {
            id: `file-${fileIndex++}`,
            name,
            type,
            content: '',
            isStreaming: true,
          },
        });
        break;
      }

      // No more tags, remainder is pure text
      const remainingText = rawText.slice(cursor);
      if (remainingText) {
        segments.push({ type: 'text', content: remainingText });
      }
      break;
    }

    const openTagStart = openMatch.index;
    const openTagEnd = openTagStart + openMatch[0].length;

    // Add text preceding the tag
    if (openTagStart > cursor) {
      const textBefore = rawText.slice(cursor, openTagStart);
      if (textBefore) {
        segments.push({ type: 'text', content: textBefore });
      }
    }

    const attrs = openMatch[1] || '';
    const name = getAttr(attrs, 'name') || 'artifact.txt';
    const type = inferType(name, getAttr(attrs, 'type'));

    // Search for closing tag starting from after the open tag
    const closeTagIndex = rawText.indexOf(closeTag, openTagEnd);

    if (closeTagIndex !== -1) {
      // Tag is complete
      const content = rawText.slice(openTagEnd, closeTagIndex);
      segments.push({
        type: 'file',
        file: {
          id: `file-${fileIndex++}`,
          name,
          type,
          content,
          isStreaming: false,
        },
      });
      cursor = closeTagIndex + closeTag.length;
    } else {
      // Tag is unclosed (still streaming)
      const content = rawText.slice(openTagEnd);
      segments.push({
        type: 'file',
        file: {
          id: `file-${fileIndex++}`,
          name,
          type,
          content,
          isStreaming: isMessageStreaming,
        },
      });
      cursor = rawText.length;
      break;
    }
  }

  return segments;
}

/**
 * Triggers a browser download for a generated file.
 */
export function downloadFile(filename: string, content: string, type?: string) {
  if (typeof window === 'undefined') return;

  const mimeTypes: Record<string, string> = {
    html: 'text/html;charset=utf-8',
    css: 'text/css;charset=utf-8',
    js: 'text/javascript;charset=utf-8',
    javascript: 'text/javascript;charset=utf-8',
    json: 'application/json;charset=utf-8',
    md: 'text/markdown;charset=utf-8',
    markdown: 'text/markdown;charset=utf-8',
    py: 'text/x-python;charset=utf-8',
    python: 'text/x-python;charset=utf-8',
    txt: 'text/plain;charset=utf-8',
    text: 'text/plain;charset=utf-8',
    ts: 'text/typescript;charset=utf-8',
    typescript: 'text/typescript;charset=utf-8',
    jsx: 'text/javascript;charset=utf-8',
    tsx: 'text/typescript;charset=utf-8',
    svg: 'image/svg+xml;charset=utf-8',
    xml: 'application/xml;charset=utf-8',
    sql: 'application/sql;charset=utf-8',
    sh: 'application/x-sh;charset=utf-8',
    bash: 'application/x-sh;charset=utf-8',
  };

  const cleanExt = (filename.split('.').pop() || type || 'txt').toLowerCase();
  const mimeType = (type && mimeTypes[type.toLowerCase()]) || mimeTypes[cleanExt] || 'text/plain;charset=utf-8';

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `file.${cleanExt}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
