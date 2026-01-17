export interface ParsedCommand {
  name: string;
  args: string[];
}

export class UnsupportedSyntaxError extends Error {
  constructor(feature: string) {
    super(`Unsupported syntax: ${feature}`);
    this.name = 'UnsupportedSyntaxError';
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Simple shell command parser.
 * Supports:
 * - Single command with arguments
 * - Double-quoted strings ("hello world")
 * - Single-quoted strings ('hello world')
 * - Escape sequences in double quotes (\", \\, \n, \t)
 * - Backslash escaping outside quotes
 *
 * Does NOT support (throws UnsupportedSyntaxError):
 * - Pipes (|)
 * - Redirections (>, <, >>)
 * - Command chaining (&&, ||, ;)
 * - Subshells ($(), ``)
 * - Variable expansion ($VAR)
 */
export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Check for unsupported syntax before parsing
  checkUnsupportedSyntax(trimmed);

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) {
    return null;
  }

  return {
    name: tokens[0],
    args: tokens.slice(1),
  };
}

function checkUnsupportedSyntax(input: string): void {
  // Simple checks for unsupported operators (outside quotes)
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && !inSingle) {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    // Only check for operators outside quotes
    if (!inSingle && !inDouble) {
      if (char === '|') {
        throw new UnsupportedSyntaxError('pipes (|)');
      }
      if (char === '>' || char === '<') {
        throw new UnsupportedSyntaxError('redirections (>, <, >>)');
      }
      if (char === '&' && next === '&') {
        throw new UnsupportedSyntaxError('logical AND (&&)');
      }
      if (char === '|' && next === '|') {
        throw new UnsupportedSyntaxError('logical OR (||)');
      }
      if (char === ';') {
        throw new UnsupportedSyntaxError('command chaining (;)');
      }
      if (char === '`') {
        throw new UnsupportedSyntaxError('command substitution (``)');
      }
      if (char === '$' && next === '(') {
        throw new UnsupportedSyntaxError('command substitution ($())');
      }
    }
  }

  if (inSingle) {
    throw new ParseError('Unterminated single quote');
  }
  if (inDouble) {
    throw new ParseError('Unterminated double quote');
  }
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let hasContent = false; // Track if we've seen any content (including empty quotes)

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    // Handle escape sequences
    if (escaped) {
      if (inDouble) {
        // In double quotes, only certain escapes are valid
        switch (char) {
          case '"':
          case '\\':
          case '$':
          case '`':
            current += char;
            break;
          case 'n':
            current += '\n';
            break;
          case 't':
            current += '\t';
            break;
          case 'r':
            current += '\r';
            break;
          default:
            // Keep the backslash for unknown escapes
            current += '\\' + char;
        }
      } else if (!inSingle) {
        // Outside quotes, backslash escapes any character
        current += char;
      } else {
        // In single quotes, backslash is literal
        current += '\\' + char;
      }
      escaped = false;
      continue;
    }

    // Backslash handling
    if (char === '\\' && !inSingle) {
      escaped = true;
      continue;
    }

    // Quote handling
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      hasContent = true; // Even empty quotes count as content
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      hasContent = true; // Even empty quotes count as content
      continue;
    }

    // Whitespace handling (token separator outside quotes)
    if (!inSingle && !inDouble && /\s/.test(char)) {
      if (current || hasContent) {
        tokens.push(current);
        current = '';
        hasContent = false;
      }
      continue;
    }

    // Regular character
    current += char;
    hasContent = true;
  }

  // Don't forget the last token
  if (current || hasContent) {
    tokens.push(current);
  }

  return tokens;
}
