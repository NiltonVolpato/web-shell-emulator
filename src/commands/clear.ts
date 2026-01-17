import type { CommandFn } from '../types';

export const clear: CommandFn = (ctx) => {
  // ANSI escape sequence to clear screen and move cursor to top-left
  ctx.stdout.write('\x1b[2J\x1b[H');
  return 0;
};
