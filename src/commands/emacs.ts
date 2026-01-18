import type { CommandFn } from '../types';

export const emacs: CommandFn = (ctx) => {
  const arg = ctx.args[0];

  // If no argument, open emacs with no file
  if (!arg) {
    if (ctx.onEmacs) {
      ctx.onEmacs('');
      return 0;
    } else {
      ctx.stderr.write('emacs: editor not available\r\n');
      return 1;
    }
  }

  // Resolve file path
  let path: string;
  if (arg.startsWith('/')) {
    path = arg;
  } else if (arg === '~' || arg.startsWith('~/')) {
    const home = ctx.env.get('HOME') || '/';
    path = arg === '~' ? home : home + arg.slice(1);
  } else {
    path = ctx.cwd === '/' ? `/${arg}` : `${ctx.cwd}/${arg}`;
  }

  // Normalize path
  path = normalizePath(path);

  // Call onEmacs callback if available
  if (ctx.onEmacs) {
    ctx.onEmacs(path);
  } else {
    ctx.stderr.write('emacs: editor not available\r\n');
    return 1;
  }

  return 0;
};

function normalizePath(path: string): string {
  const parts = path.split('/').filter((p) => p && p !== '.');
  const result: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      result.pop();
    } else {
      result.push(part);
    }
  }

  return '/' + result.join('/');
}
