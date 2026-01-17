import type { CommandFn } from '../types';

export const help: CommandFn = (ctx) => {
  ctx.stdout.write('Available commands:\r\n');
  ctx.stdout.write('\r\n');
  ctx.stdout.write('  pwd       Print working directory\r\n');
  ctx.stdout.write('  whoami    Print current user\r\n');
  ctx.stdout.write('  echo      Print arguments\r\n');
  ctx.stdout.write('  ls        List directory contents\r\n');
  ctx.stdout.write('  cd        Change directory\r\n');
  ctx.stdout.write('  cat       Print file contents\r\n');
  ctx.stdout.write('  mkdir     Create directories\r\n');
  ctx.stdout.write('  clear     Clear the screen\r\n');
  ctx.stdout.write('  help      Show this help message\r\n');
  ctx.stdout.write('\r\n');
  ctx.stdout.write('Features:\r\n');
  ctx.stdout.write('  - Tab completion for commands and paths\r\n');
  ctx.stdout.write('  - Command history with up/down arrows\r\n');
  ctx.stdout.write('  - Quoted strings: echo "hello world"\r\n');
  ctx.stdout.write('\r\n');
  return 0;
};
