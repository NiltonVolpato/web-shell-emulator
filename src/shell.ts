import type { fs as FsNamespace, mounts as MountsType } from '@zenfs/core';
import type { CommandFn, CommandEntry, CommandContext, ShellOutput } from './types';
import { isLazyCommand } from './types';
import { getCommand, isBinFS } from './backends/binfs';

export interface ShellOptions {
  /** The zenfs filesystem instance */
  fs: typeof FsNamespace;
  /** The zenfs mounts map (needed to access BinFS instances) */
  mounts: typeof MountsType;
  /** Output stream for stdout */
  stdout: ShellOutput;
  /** Output stream for stderr */
  stderr: ShellOutput;
  /** Initial environment variables */
  env?: Map<string, string>;
  /** Custom prompt function */
  prompt?: () => string;
  /** Register input handler (e.g., terminal.onData) */
  onInput?: (handler: (data: string) => void) => void;
}

export class Shell {
  private fs: typeof FsNamespace;
  private mounts: typeof MountsType;
  private stdout: ShellOutput;
  private stderr: ShellOutput;
  private env: Map<string, string>;
  private cwd: string;
  private inputBuffer: string = '';
  private promptFn: () => string;
  private onInputCallback?: (handler: (data: string) => void) => void;
  // Cache for lazy-loaded commands (path -> loaded function)
  private loadedCommands: Map<string, CommandFn> = new Map();

  constructor(options: ShellOptions) {
    this.fs = options.fs;
    this.mounts = options.mounts;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
    this.env = options.env ?? new Map([
      ['PATH', '/bin:/usr/bin'],
      ['HOME', '/home/guest'],
      ['USER', 'guest'],
    ]);
    this.cwd = this.env.get('HOME') || '/';
    this.promptFn = options.prompt ?? (() =>
      `${this.env.get('USER')}@web-terminal:${this.cwd}$ `
    );
    this.onInputCallback = options.onInput;
  }

  start(): void {
    this.printWelcome();
    this.printPrompt();
    this.onInputCallback?.((data) => this.handleInput(data));
  }

  private printWelcome(): void {
    this.stdout.write('\x1b[1;32m');
    this.stdout.write('Welcome to Web Terminal!\r\n');
    this.stdout.write('\x1b[0m');
    this.stdout.write('\r\n');
    this.stdout.write('Type "help" for available commands.\r\n');
    this.stdout.write('\r\n');
  }

  private printPrompt(): void {
    this.stdout.write(this.promptFn());
  }

  /**
   * Handle incoming input data (can be called externally for testing)
   */
  handleInput(data: string): void {
    // Handle each character/sequence
    for (const char of data) {
      this.processInputChar(char);
    }
  }

  private processInputChar(char: string): void {
    if (char === '\r' || char === '\n') {
      // Enter - execute command
      this.stdout.write('\r\n');
      const line = this.inputBuffer.trim();
      this.inputBuffer = '';
      this.executeCommand(line);
      return;
    }

    if (char === '\x7f' || char === '\b') {
      // Backspace
      if (this.inputBuffer.length > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        this.stdout.write('\b \b');
      }
      return;
    }

    if (char === '\x03') {
      // Ctrl+C - cancel current input
      this.stdout.write('^C\r\n');
      this.inputBuffer = '';
      this.printPrompt();
      return;
    }

    // Skip other control characters
    if (char.charCodeAt(0) < 32 && char !== '\t') {
      return;
    }

    // Regular character - echo and add to buffer
    this.inputBuffer += char;
    this.stdout.write(char);
  }

  private async executeCommand(line: string): Promise<void> {
    if (!line) {
      this.printPrompt();
      return;
    }

    // Simple parsing: split by whitespace, first word is command
    const parts = line.split(/\s+/);
    const cmdName = parts[0];
    const args = parts.slice(1);

    // For now: error if there are arguments
    if (args.length > 0) {
      this.stderr.write('Error: Arguments not yet supported\r\n');
      this.printPrompt();
      return;
    }

    const commandFn = await this.resolveCommand(cmdName);
    if (!commandFn) {
      this.stderr.write(`${cmdName}: command not found\r\n`);
      this.printPrompt();
      return;
    }

    const ctx: CommandContext = {
      args,
      env: this.env,
      cwd: this.cwd,
      stdout: this.stdout,
      stderr: this.stderr,
      fs: this.fs,
    };

    try {
      await commandFn(ctx);
    } catch (err) {
      this.stderr.write(`Error: ${err}\r\n`);
    }

    this.printPrompt();
  }

  private async resolveCommand(name: string): Promise<CommandFn | null> {
    const pathDirs = (this.env.get('PATH') || '').split(':');

    for (const dir of pathDirs) {
      const fullPath = `${dir}/${name}`;

      // Check if file exists
      try {
        if (!this.fs.existsSync(fullPath)) {
          continue;
        }
      } catch {
        continue;
      }

      // Check if we already loaded this command (for lazy commands)
      const cached = this.loadedCommands.get(fullPath);
      if (cached) {
        return cached;
      }

      // Get the command entry from BinFS
      const entry = this.getCommandFromPath(dir, name);
      if (!entry) {
        continue;
      }

      // Handle lazy loading
      if (isLazyCommand(entry)) {
        const loadedFn = await entry();
        this.loadedCommands.set(fullPath, loadedFn);
        return loadedFn;
      }

      return entry;
    }

    return null;
  }

  private getCommandFromPath(mountPath: string, name: string): CommandEntry | null {
    // Find the filesystem mounted at the given path
    const mountedFs = this.mounts.get(mountPath);
    if (!mountedFs) {
      return null;
    }

    // Check if it's a BinFS instance
    if (!isBinFS(mountedFs)) {
      return null;
    }

    // Get the command from BinFS
    return getCommand(mountedFs, name) ?? null;
  }
}
