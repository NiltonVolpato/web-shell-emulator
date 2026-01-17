import type { CommandFn } from '../types';

export const echo: CommandFn = (ctx) => {
  const output = ctx.args.join(' ');
  // Convert \n to \r\n for terminal display
  ctx.stdout.write(output.replace(/\r?\n/g, '\r\n') + '\r\n');
  return 0;
};
