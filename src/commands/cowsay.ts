import type { CommandFn } from '../types';
import * as cowsay from 'cowsay';

export const cowsayCmd: CommandFn = (ctx) => {
  const message = ctx.args.join(' ') || 'Moo!';
  const output = cowsay.say({ text: message });
  // Convert \n to \r\n for terminal display
  ctx.stdout.write(output.replace(/\n/g, '\r\n') + '\r\n');
  return 0;
};
