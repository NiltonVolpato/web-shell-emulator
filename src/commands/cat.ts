import type { CommandFn } from '../types';

export const cat: CommandFn = (ctx) => {
  if (ctx.args.length === 0) {
    ctx.stderr.write('cat: missing file operand\r\n');
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
      const stat = ctx.fs.statSync(path);

      if (stat.isDirectory()) {
        ctx.stderr.write(`cat: ${arg}: Is a directory\r\n`);
        exitCode = 1;
        continue;
      }

      const content = ctx.fs.readFileSync(path, 'utf-8');
      // Convert \n to \r\n for terminal display
      ctx.stdout.write(content.replace(/\n/g, '\r\n'));

      // Add newline if file doesn't end with one
      if (content.length > 0 && !content.endsWith('\n')) {
        ctx.stdout.write('\r\n');
      }
    } catch {
      ctx.stderr.write(`cat: ${arg}: No such file or directory\r\n`);
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
