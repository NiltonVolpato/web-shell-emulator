import type { CommandFn } from '../types';
import { hyperlink } from '../hyperlink';

export const ls: CommandFn = (ctx) => {
  const target = ctx.args[0] || ctx.cwd;

  // Resolve path
  let path: string;
  if (target.startsWith('/')) {
    path = target;
  } else if (target === '~' || target.startsWith('~/')) {
    const home = ctx.env.get('HOME') || '/';
    path = target === '~' ? home : home + target.slice(1);
  } else {
    path = ctx.cwd === '/' ? `/${target}` : `${ctx.cwd}/${target}`;
  }

  // Normalize path
  path = normalizePath(path);

  try {
    const stat = ctx.fs.statSync(path);

    if (stat.isDirectory()) {
      const entries = ctx.fs.readdirSync(path);
      if (entries.length === 0) {
        return 0;
      }

      // Get details for each entry
      const items: Array<{ name: string; isDir: boolean }> = [];
      for (const entry of entries) {
        const entryPath = path === '/' ? `/${entry}` : `${path}/${entry}`;
        try {
          const entryStat = ctx.fs.statSync(entryPath);
          items.push({ name: entry, isDir: entryStat.isDirectory() });
        } catch {
          items.push({ name: entry, isDir: false });
        }
      }

      // Sort: directories first, then alphabetically
      items.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      // Output
      for (const item of items) {
        const entryPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;

        if (item.isDir) {
          ctx.stdout.write(`\x1b[1;34m${item.name}/\x1b[0m\r\n`);
        } else if (entryPath.startsWith('/site/')) {
          // For /site/* files, make them clickable hyperlinks
          const url = entryPath.slice(5).replace(/\.md$/, ''); // /site/about.md -> /about
          ctx.stdout.write(hyperlink(url, item.name) + '\r\n');
        } else {
          ctx.stdout.write(`${item.name}\r\n`);
        }
      }
    } else {
      // It's a file, just print its name
      ctx.stdout.write(`${target}\r\n`);
    }

    return 0;
  } catch {
    ctx.stderr.write(`ls: cannot access '${target}': No such file or directory\r\n`);
    return 1;
  }
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
