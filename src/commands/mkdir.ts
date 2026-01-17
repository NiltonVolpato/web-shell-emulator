import type { CommandFn } from '../types';

export const mkdir: CommandFn = (ctx) => {
  if (ctx.args.length === 0) {
    ctx.stderr.write('mkdir: missing operand\r\n');
    return 1;
  }

  let exitCode = 0;

  for (const arg of ctx.args) {
    // Resolve path
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

    try {
      ctx.fs.mkdirSync(path, { recursive: true });
    } catch (err) {
      ctx.stderr.write(`mkdir: cannot create directory '${arg}': ${err}\r\n`);
      exitCode = 1;
    }
  }

  return exitCode;
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
