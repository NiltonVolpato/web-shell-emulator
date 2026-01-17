import type { CommandFn } from '../types';

export const cd: CommandFn = (ctx) => {
  const target = ctx.args[0] || ctx.env.get('HOME') || '/';

  // Resolve the path
  let newPath: string;
  if (target.startsWith('/')) {
    newPath = normalizePath(target);
  } else if (target === '~' || target.startsWith('~/')) {
    const home = ctx.env.get('HOME') || '/';
    newPath = target === '~' ? home : normalizePath(home + target.slice(1));
  } else if (target === '-') {
    // Go to previous directory
    const oldPwd = ctx.env.get('OLDPWD');
    if (!oldPwd) {
      ctx.stderr.write('cd: OLDPWD not set\r\n');
      return 1;
    }
    newPath = oldPwd;
  } else {
    newPath = normalizePath(`${ctx.cwd}/${target}`);
  }

  // Check if directory exists
  try {
    const stat = ctx.fs.statSync(newPath);
    if (!stat.isDirectory()) {
      ctx.stderr.write(`cd: ${target}: Not a directory\r\n`);
      return 1;
    }
  } catch {
    ctx.stderr.write(`cd: ${target}: No such file or directory\r\n`);
    return 1;
  }

  // Save old directory and change
  ctx.env.set('OLDPWD', ctx.cwd);
  ctx.setCwd(newPath);
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
