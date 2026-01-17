import type { CommandFn } from '../types';

export const whoami: CommandFn = (ctx) => {
  const user = ctx.env.get('USER') || 'unknown';
  ctx.stdout.write(user + '\r\n');
  return 0;
};
