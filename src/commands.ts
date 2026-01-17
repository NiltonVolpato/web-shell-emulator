import type { CommandEntry } from './types';

/**
 * Default commands available in /bin
 */
export const defaultCommands: Map<string, CommandEntry> = new Map([
  ['pwd', (ctx) => {
    ctx.stdout.write(ctx.cwd + '\r\n');
    return 0;
  }],

  ['whoami', (ctx) => {
    const user = ctx.env.get('USER') || 'unknown';
    ctx.stdout.write(user + '\r\n');
    return 0;
  }],

  ['help', (ctx) => {
    ctx.stdout.write('Available commands:\r\n');
    ctx.stdout.write('  pwd     - Print working directory\r\n');
    ctx.stdout.write('  whoami  - Print current user\r\n');
    ctx.stdout.write('  help    - Show this help message\r\n');
    ctx.stdout.write('  clear   - Clear the screen\r\n');
    ctx.stdout.write('\r\n');
    ctx.stdout.write('More commands coming soon!\r\n');
    return 0;
  }],

  ['clear', (ctx) => {
    // ANSI escape sequence to clear screen and move cursor to top-left
    ctx.stdout.write('\x1b[2J\x1b[H');
    return 0;
  }],
]);
