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

// Parser
export { parseCommand, UnsupportedSyntaxError, ParseError } from './parser';
export type { ParsedCommand } from './parser';

// BinFS backend
export { BinFS, getCommand, isBinFS } from './backends/binfs';
export type { BinFSOptions } from './backends/binfs';

// Commands
export { defaultCommands } from './commands/index';
export * from './commands/index';

// Testing utilities
export { StringOutput } from './testing';
