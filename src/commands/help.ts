import type { CommandFn } from '../types';

export const help: CommandFn = (ctx) => {
  // Auto-discover commands from PATH directories
  const pathDirs = (ctx.env.get('PATH') || '').split(':');
  const commands = new Set<string>();

  for (const dir of pathDirs) {
    try {
      const entries = ctx.fs.readdirSync(dir);
      for (const entry of entries) {
        commands.add(entry);
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  const sortedCommands = Array.from(commands).sort();

  ctx.stdout.write('Available commands:\r\n');
  ctx.stdout.write('\r\n');
  ctx.stdout.write('  ' + sortedCommands.join(', ') + '\r\n');
  ctx.stdout.write('\r\n');
  ctx.stdout.write('Features:\r\n');
  ctx.stdout.write('  - Tab completion for commands and paths\r\n');
  ctx.stdout.write('  - Command history with up/down arrows\r\n');
  ctx.stdout.write('  - Quoted strings: echo "hello world"\r\n');
  ctx.stdout.write('  - open: Open files in browser or URLs directly\r\n');
  ctx.stdout.write('\r\n');
  return 0;
};
