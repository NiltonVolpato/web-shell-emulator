import type { CommandFn } from '../types';

export const pwd: CommandFn = (ctx) => {
  ctx.stdout.write(ctx.cwd + '\r\n');
  return 0;
};
