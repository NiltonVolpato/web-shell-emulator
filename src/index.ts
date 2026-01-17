// Main exports
export { Shell } from './shell';
export type { ShellOptions } from './shell';

// Types
export type {
  ShellOutput,
  CommandContext,
  CommandFn,
  LazyCommandFn,
  CommandEntry,
} from './types';
export { isLazyCommand } from './types';

// BinFS backend
export { BinFS, getCommand, isBinFS } from './backends/binfs';
export type { BinFSOptions } from './backends/binfs';

// Default commands
export { defaultCommands } from './commands';

// Testing utilities
export { StringOutput } from './testing';
