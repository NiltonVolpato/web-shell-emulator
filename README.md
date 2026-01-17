# Web Shell Emulator

A browser-based shell emulator that provides a Linux-like terminal experience. Built with TypeScript, it features a virtual filesystem, command execution, and a familiar shell interface.

## Features

- **Virtual Filesystem**: In-memory filesystem using [@zenfs/core](https://zenfs.dev/)
- **Shell Commands**: `ls`, `cd`, `cat`, `echo`, `pwd`, `whoami`, `mkdir`, `clear`, `help`
- **Command Parsing**: Supports quoted strings, escape sequences
- **Tab Completion**: Commands and file paths
- **Command History**: Navigate with up/down arrows
- **Colored Output**: Directory listings, prompts (using [chalk](https://github.com/chalk/chalk))
- **Terminal Rendering**: [ghostty-web](https://github.com/ghostty-org/ghostty) (xterm.js-compatible)

## Quick Start

```bash
npm install
npm run dev     # Start dev server at http://localhost:5173
npm run test    # Run tests in watch mode
npm run build   # Build library for distribution
```

## Architecture

```
src/
├── shell.ts              # Main Shell class - input handling, command execution
├── parser.ts             # Command line parser (quotes, escapes, tokenization)
├── types.ts              # Core types (CommandFn, CommandContext, ShellOutput)
├── testing.ts            # StringOutput for testing
├── index.ts              # Public exports
├── backends/
│   └── binfs.ts          # Custom ZenFS backend for executable commands
└── commands/
    ├── index.ts          # Exports all commands + defaultCommands map
    ├── pwd.ts            # Print working directory
    ├── whoami.ts         # Print current user
    ├── echo.ts           # Print arguments
    ├── ls.ts             # List directory contents
    ├── cd.ts             # Change directory
    ├── cat.ts            # Print file contents
    ├── mkdir.ts          # Create directories
    ├── clear.ts          # Clear screen
    └── help.ts           # Show help
```

## Key Concepts

### Shell

The `Shell` class orchestrates everything:

```typescript
import { Shell } from 'web-shell-emulator';

const shell = new Shell({
  fs,                    // ZenFS filesystem instance
  mounts,                // ZenFS mounts map (for BinFS lookup)
  stdout: output,        // ShellOutput interface
  stderr: output,        // ShellOutput interface
  onInput: (handler) => term.onData(handler),  // Input subscription
  colorLevel: 3,         // Chalk color level (0=none, 3=truecolor)
  prompt: (shell) => `${shell.cwd}$ `,  // Optional custom prompt
  env: new Map([...]),   // Optional initial environment
});

shell.start();
```

### BinFS - Executable Filesystem

Commands are stored in a custom ZenFS backend called `BinFS`. Each mount point has its own command registry:

```typescript
import { configure, InMemory } from '@zenfs/core';
import { BinFS } from 'web-shell-emulator';

await configure({
  mounts: {
    '/': InMemory,
    '/bin': { backend: BinFS, commands: defaultCommands },
    '/usr/bin': { backend: BinFS, commands: otherCommands },
  },
});
```

The shell searches `$PATH` directories and looks up command functions from the appropriate BinFS mount.

### Commands

Commands are functions with this signature:

```typescript
type CommandFn = (ctx: CommandContext) => Promise<number> | number;

interface CommandContext {
  args: string[];                    // Parsed arguments
  env: Map<string, string>;          // Environment variables
  cwd: string;                       // Current working directory
  stdout: ShellOutput;               // Write output here
  stderr: ShellOutput;               // Write errors here
  fs: typeof import('@zenfs/core').fs;  // Filesystem access
  setCwd: (path: string) => void;    // Change directory (for cd)
}
```

Example command:

```typescript
export const echo: CommandFn = (ctx) => {
  const output = ctx.args.join(' ');
  ctx.stdout.write(output.replace(/\r?\n/g, '\r\n') + '\r\n');
  return 0;  // Exit code
};
```

### Lazy Loading Commands

For commands that need to load heavy resources:

```typescript
const commands = new Map([
  ['heavy', async () => {
    const data = await fetch('/large-data.json').then(r => r.json());
    return (ctx) => {
      ctx.stdout.write(`Loaded ${data.length} items\r\n`);
      return 0;
    };
  }],
]);
```

### Parser

The parser (`src/parser.ts`) handles:
- Single commands with arguments
- Double-quoted strings: `echo "hello world"`
- Single-quoted strings: `echo 'hello world'`
- Escape sequences: `\n`, `\t`, `\\`, `\"`
- Backslash escaping: `echo hello\ world`

**Not supported** (throws `UnsupportedSyntaxError`):
- Pipes: `|`
- Redirections: `>`, `<`, `>>`
- Chaining: `&&`, `||`, `;`
- Command substitution: `$()`, `` ` ``
- Variable expansion: `$VAR`

### Environment Variables

Default environment:
- `PATH`: `/bin:/usr/bin`
- `HOME`: `/home/guest`
- `USER`: `guest`
- `PWD`: Updated on `cd`
- `OLDPWD`: Previous directory (for `cd -`)
- `?`: Last exit code

## Testing

Tests use [Vitest](https://vitest.dev/) and the `StringOutput` class:

```typescript
import { StringOutput } from 'web-shell-emulator';
import { echo } from 'web-shell-emulator';

const stdout = new StringOutput();
echo({ args: ['hello'], stdout, ... });
expect(stdout.toString()).toBe('hello\r\n');
```

Run tests:
```bash
npm test        # Watch mode
npm run test:run  # Single run
```

## Demo

The `demo/` directory contains a working example:

```typescript
// demo/main.ts
import { init, Terminal, FitAddon } from 'ghostty-web';
import { configure, fs, mounts, InMemory } from '@zenfs/core';
import { Shell, BinFS, defaultCommands } from '../src';

await init();
await configure({
  mounts: {
    '/': InMemory,
    '/bin': { backend: BinFS, commands: defaultCommands },
  },
});

fs.mkdirSync('/home/guest', { recursive: true });

const term = new Terminal({ fontSize: 14 });
term.open(document.querySelector('#terminal')!);

const shell = new Shell({
  fs, mounts,
  stdout: { write: (t) => term.write(t) },
  stderr: { write: (t) => term.write(t) },
  onInput: (h) => term.onData(h),
});

shell.start();
```

## Adding New Commands

1. Create `src/commands/mycommand.ts`:

```typescript
import type { CommandFn } from '../types';

export const mycommand: CommandFn = (ctx) => {
  // Implementation
  ctx.stdout.write('Output\r\n');
  return 0;
};
```

2. Export from `src/commands/index.ts`:

```typescript
export { mycommand } from './mycommand';

export const defaultCommands = new Map([
  // ...existing commands
  ['mycommand', mycommand],
]);
```

3. Add tests in `src/__tests__/commands.test.ts`

4. Update help text in `src/commands/help.ts`

## Terminal Output

Always use `\r\n` for line breaks in terminal output (not just `\n`).

## Future Ideas

- [ ] Full bash parsing (reference implementation in `reference/bash-parser/`)
- [ ] Variable expansion (`$VAR`, `${VAR}`)
- [ ] Pipes and redirections
- [ ] More commands (`rm`, `cp`, `mv`, `touch`, `grep`, `head`, `tail`)
- [ ] Persistent storage (IndexedDB via @zenfs/dom)
- [ ] Custom command registration API

## Project Structure

```
web-shell-emulator/
├── src/                 # Library source
├── demo/                # Demo application
├── dist/                # Built library (after npm run build)
├── reference/           # Reference implementations (bash-parser, zenfs, ghostty)
├── package.json
├── tsconfig.json        # TypeScript config (dev)
├── tsconfig.build.json  # TypeScript config (declarations)
├── vite.config.ts       # Vite build config
└── vitest.config.ts     # Test config
```

## License

ISC
