import type { CommandFn } from '../types';

export const open: CommandFn = (ctx) => {
  if (ctx.args.length === 0) {
    ctx.stderr.write('open: missing file or URL operand\r\n');
    return 1;
  }

  const arg = ctx.args[0];

  // Check if it's a URL (http://, https://, or www.)
  if (arg.startsWith('http://') || arg.startsWith('https://') || arg.startsWith('www.')) {
    // It's a URL - pass directly to onOpen
    if (ctx.onOpen) {
      ctx.onOpen(arg);
      return 0;
    } else {
      ctx.stderr.write(`open: browser not available\r\n`);
      return 1;
    }
  }

  // It's a file path - resolve it
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

  // Check if file exists
  try {
    const stat = ctx.fs.statSync(path);
    if (stat.isDirectory()) {
      ctx.stderr.write(`open: ${arg}: Is a directory\r\n`);
      return 1;
    }
  } catch {
    ctx.stderr.write(`open: ${arg}: No such file or directory\r\n`);
    return 1;
  }

  // Map /site/* paths to URLs
  let url = path;
  if (url.startsWith('/site')) {
    url = url.slice(5); // Remove /site prefix
  }
  url = url.replace(/\.md$/, ''); // Remove .md extension

  // Ensure URL starts with /
  if (!url.startsWith('/')) {
    url = '/' + url;
  }

  // Call onOpen callback if available
  if (ctx.onOpen) {
    ctx.onOpen(url);
  } else {
    ctx.stderr.write(`open: browser not available\r\n`);
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
