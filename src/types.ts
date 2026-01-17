import type { fs } from '@zenfs/core';

export interface ShellOutput {
  write(text: string): void;
}

export interface CommandContext {
  args: string[];
  env: Map<string, string>;
  cwd: string;
  stdout: ShellOutput;
  stderr: ShellOutput;
  fs: typeof fs;
  /** Change the current working directory (for cd command) */
  setCwd: (path: string) => void;
}

/** A command function that executes with the given context and returns an exit code */
export type CommandFn = (ctx: CommandContext) => Promise<number> | number;

/** A lazy command loader that returns the actual command function when invoked */
export type LazyCommandFn = () => Promise<CommandFn>;

/** A command entry can be either a direct function or a lazy loader */
export type CommandEntry = CommandFn | LazyCommandFn;

/** Type guard to check if a command entry is a lazy loader */
export function isLazyCommand(entry: CommandEntry): entry is LazyCommandFn {
  // Lazy commands are async functions with no parameters that return a CommandFn
  // We check by looking at the function's length (number of parameters)
  // CommandFn has 1 param (ctx), LazyCommandFn has 0 params
  return entry.length === 0;
}
