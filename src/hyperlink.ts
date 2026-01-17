/**
 * OSC 8 hyperlink escape sequence utility
 *
 * Creates clickable hyperlinks in terminal output using the OSC 8 standard.
 * Most modern terminals support this (iTerm2, Terminal.app, GNOME Terminal, etc.)
 *
 * Format: ESC ] 8 ; params ; uri BEL text ESC ] 8 ; ; BEL
 */

/**
 * Wrap text in an OSC 8 hyperlink escape sequence
 *
 * @param url The URL to link to
 * @param text The display text (defaults to the URL if not provided)
 * @param params Optional link parameters (e.g., id for cross-line links)
 * @returns The text wrapped in OSC 8 escape sequences
 *
 * @example
 * ```ts
 * // Basic usage
 * ctx.stdout.write(hyperlink('https://example.com', 'Example'));
 *
 * // URL as text
 * ctx.stdout.write(hyperlink('https://example.com'));
 *
 * // With params
 * ctx.stdout.write(hyperlink('https://example.com', 'Example', { id: 'link1' }));
 * ```
 */
export function hyperlink(
  url: string,
  text?: string,
  params?: Record<string, string>,
): string {
  const displayText = text ?? url;

  // Build params string (key=value pairs separated by :)
  let paramsStr = '';
  if (params) {
    paramsStr = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join(':');
  }

  // OSC 8 format: \x1b]8;params;uri\x07text\x1b]8;;\x07
  return `\x1b]8;${paramsStr};${url}\x07${displayText}\x1b]8;;\x07`;
}

/**
 * Create a file:// hyperlink for a local path
 *
 * @param path The filesystem path
 * @param text The display text (defaults to the path if not provided)
 * @returns The text wrapped in OSC 8 escape sequences
 */
export function fileLink(path: string, text?: string): string {
  const url = `file://${path}`;
  return hyperlink(url, text ?? path);
}
