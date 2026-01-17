import type { fs as FsNamespace, mounts as MountsType } from '@zenfs/core';
import type {
  CommandFn,
  CommandEntry,
  CommandContext,
  ShellOutput,
} from './types';
import { isLazyCommand } from './types';
import { getCommand, isBinFS } from './backends/binfs';
import { parseCommand, UnsupportedSyntaxError, ParseError } from './parser';
import { Chalk } from 'chalk';

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
  prompt?: (shell: Shell) => string;
  /** Register input handler (e.g., terminal.onData) */
  onInput?: (handler: (data: string) => void) => void;
  /** Chalk color level (0=none, 1=basic, 2=256, 3=truecolor). Default: 3 */
  colorLevel?: 0 | 1 | 2 | 3;
  /** Callback when the open command is invoked */
  onOpen?: (url: string) => void;
}

export class Shell {
  private fs: typeof FsNamespace;
  private mounts: typeof MountsType;
  private stdout: ShellOutput;
  private stderr: ShellOutput;
  private env: Map<string, string>;
  private _cwd: string;
  private inputBuffer: string = '';
  private promptFn: (shell: Shell) => string;
  private onInputCallback?: (handler: (data: string) => void) => void;
  private onOpenCallback?: (url: string) => void;
  // Cache for lazy-loaded commands (path -> loaded function)
  private loadedCommands: Map<string, CommandFn> = new Map();
  // Command history
  private history: string[] = [];
  private historyIndex: number = -1;
  private savedInput: string = '';
  // Escape sequence buffer for multi-char sequences (arrows, etc.)
  private escapeBuffer: string = '';
  // Chalk instance for colors
  readonly chalk: InstanceType<typeof Chalk>;

  constructor(options: ShellOptions) {
    this.fs = options.fs;
    this.mounts = options.mounts;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
    this.chalk = new Chalk({ level: options.colorLevel ?? 3 });
    this.env =
      options.env ??
      new Map([
        ['PATH', '/bin:/usr/bin'],
        ['HOME', '/home/guest'],
        ['USER', 'guest'],
      ]);
    this._cwd = this.env.get('HOME') || '/';
    this.promptFn =
      options.prompt ??
      ((shell) =>
        shell.chalk.greenBright(`${shell.env.get('USER')}@web-shell`) +
        ':' +
        shell.chalk.hex('#56b6c2')(`${shell.cwd}`) +
        '$ ');
    this.onInputCallback = options.onInput;
    this.onOpenCallback = options.onOpen;
  }

  /** Current working directory */
  get cwd(): string {
    return this._cwd;
  }

  /** Set current working directory */
  set cwd(path: string) {
    this._cwd = path;
    this.env.set('PWD', path);
  }

  async start(): Promise<void> {
    this.printWelcome();
    await this.sourceProfile();
    this.printPrompt();
    this.onInputCallback?.((data) => this.handleInput(data));
  }

  /**
   * Source profile files (.profile, .bashrc) on startup
   */
  private async sourceProfile(): Promise<void> {
    const home = this.env.get('HOME') || '/';
    const profilePaths = [
      `${home}/.profile`,
      `${home}/.bashrc`,
    ];

    for (const profilePath of profilePaths) {
      try {
        if (!this.fs.existsSync(profilePath)) {
          continue;
        }

        const content = this.fs.readFileSync(profilePath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          // Skip empty lines and comments
          if (!trimmed || trimmed.startsWith('#')) {
            continue;
          }
          // Execute the line (errors are silently ignored during profile sourcing)
          try {
            await this.executeCommand(trimmed);
          } catch {
            // Ignore errors during profile sourcing
          }
        }
        // Only source the first found profile
        break;
      } catch {
        // Profile doesn't exist or can't be read, continue
      }
    }
  }

  private printWelcome(): void {
    this.stdout.write(this.chalk.green.bold('Welcome to Web Shell!\r\n'));
    this.stdout.write('\r\n');
    this.stdout.write('Type "help" for available commands.\r\n');
    this.stdout.write('\r\n');
  }

  private printPrompt(): void {
    this.stdout.write(this.promptFn(this));
  }

  /**
   * Handle incoming input data (can be called externally for testing)
   */
  handleInput(data: string): void {
    for (let i = 0; i < data.length; i++) {
      const char = data[i];

      // If we're in an escape sequence
      if (this.escapeBuffer.length > 0) {
        this.escapeBuffer += char;

        // Check for complete escape sequences
        if (this.escapeBuffer === '\x1b[A') {
          // Up arrow - previous history
          this.historyUp();
          this.escapeBuffer = '';
        } else if (this.escapeBuffer === '\x1b[B') {
          // Down arrow - next history
          this.historyDown();
          this.escapeBuffer = '';
        } else if (this.escapeBuffer === '\x1b[C') {
          // Right arrow - ignore for now
          this.escapeBuffer = '';
        } else if (this.escapeBuffer === '\x1b[D') {
          // Left arrow - ignore for now
          this.escapeBuffer = '';
        } else if (this.escapeBuffer.length >= 3) {
          // Unknown escape sequence, discard
          this.escapeBuffer = '';
        }
        continue;
      }

      // Start of escape sequence
      if (char === '\x1b') {
        this.escapeBuffer = '\x1b';
        continue;
      }

      this.processInputChar(char);
    }
  }

  private historyUp(): void {
    if (this.history.length === 0) return;

    if (this.historyIndex === -1) {
      // Save current input before navigating history
      this.savedInput = this.inputBuffer;
      this.historyIndex = this.history.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex--;
    } else {
      return; // Already at oldest
    }

    this.replaceInputLine(this.history[this.historyIndex]);
  }

  private historyDown(): void {
    if (this.historyIndex === -1) return;

    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.replaceInputLine(this.history[this.historyIndex]);
    } else {
      // Restore saved input
      this.historyIndex = -1;
      this.replaceInputLine(this.savedInput);
    }
  }

  private replaceInputLine(newLine: string): void {
    // Clear current line
    const clearLen = this.inputBuffer.length;
    this.stdout.write('\b'.repeat(clearLen) + ' '.repeat(clearLen) + '\b'.repeat(clearLen));

    // Write new line
    this.inputBuffer = newLine;
    this.stdout.write(newLine);
  }

  private processInputChar(char: string): void {
    if (char === '\r' || char === '\n') {
      // Enter - execute command
      this.stdout.write('\r\n');
      const line = this.inputBuffer.trim();
      this.inputBuffer = '';

      // Add to history if non-empty and different from last
      if (line && (this.history.length === 0 || this.history[this.history.length - 1] !== line)) {
        this.history.push(line);
      }
      this.historyIndex = -1;

      this.executeCommandFromInput(line);
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
      this.historyIndex = -1;
      this.printPrompt();
      return;
    }

    if (char === '\t') {
      // Tab - autocomplete
      this.handleTabCompletion();
      return;
    }

    // Skip other control characters
    if (char.charCodeAt(0) < 32) {
      return;
    }

    // Regular character - echo and add to buffer
    this.inputBuffer += char;
    this.stdout.write(char);
  }

  private handleTabCompletion(): void {
    const input = this.inputBuffer;
    const parts = input.split(/\s+/);

    if (parts.length <= 1) {
      // Complete command name
      const prefix = parts[0] || '';
      const completions = this.getCommandCompletions(prefix);

      if (completions.length === 1) {
        // Single match - complete it
        const completion = completions[0].slice(prefix.length);
        this.inputBuffer += completion + ' ';
        this.stdout.write(completion + ' ');
      } else if (completions.length > 1) {
        // Multiple matches - show them
        this.stdout.write('\r\n');
        this.stdout.write(completions.join('  ') + '\r\n');
        this.printPrompt();
        this.stdout.write(this.inputBuffer);
      }
    } else {
      // Complete file/directory path
      const pathPrefix = parts[parts.length - 1];
      const completions = this.getPathCompletions(pathPrefix);

      if (completions.length === 1) {
        const completion = completions[0].slice(pathPrefix.length);
        this.inputBuffer += completion;
        this.stdout.write(completion);
      } else if (completions.length > 1) {
        this.stdout.write('\r\n');
        this.stdout.write(completions.join('  ') + '\r\n');
        this.printPrompt();
        this.stdout.write(this.inputBuffer);
      }
    }
  }

  private getCommandCompletions(prefix: string): string[] {
    const completions: string[] = [];
    const pathDirs = (this.env.get('PATH') || '').split(':');

    for (const dir of pathDirs) {
      try {
        const entries = this.fs.readdirSync(dir);
        for (const entry of entries) {
          if (entry.startsWith(prefix) && !completions.includes(entry)) {
            completions.push(entry);
          }
        }
      } catch {
        // Directory doesn't exist or can't be read
      }
    }

    return completions.sort();
  }

  private getPathCompletions(prefix: string): string[] {
    const completions: string[] = [];

    // Resolve the directory to search in
    let searchDir: string;
    let filePrefix: string;
    let dirPrefix: string; // The prefix to prepend to completions

    if (prefix.includes('/')) {
      const lastSlash = prefix.lastIndexOf('/');
      searchDir = prefix.slice(0, lastSlash) || '/';
      filePrefix = prefix.slice(lastSlash + 1);
      // Keep the original path prefix (up to and including the last slash)
      dirPrefix = prefix.slice(0, lastSlash + 1);

      // Resolve relative paths for searching
      if (!searchDir.startsWith('/')) {
        searchDir = this.resolvePath(searchDir);
      }
    } else {
      searchDir = this.cwd;
      filePrefix = prefix;
      dirPrefix = ''; // No directory prefix for bare filenames
    }

    try {
      const entries = this.fs.readdirSync(searchDir);
      for (const entry of entries) {
        if (entry.startsWith(filePrefix)) {
          // Check if it's a directory to add trailing slash
          const fullPath = searchDir === '/' ? `/${entry}` : `${searchDir}/${entry}`;
          try {
            const stat = this.fs.statSync(fullPath);
            if (stat.isDirectory()) {
              completions.push(dirPrefix + entry + '/');
            } else {
              completions.push(dirPrefix + entry);
            }
          } catch {
            completions.push(dirPrefix + entry);
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return completions.sort();
  }

  /**
   * Execute a command line and return the exit code.
   * This is the public API for running commands programmatically.
   */
  async executeCommand(line: string): Promise<number> {
    if (!line) {
      return 0;
    }

    // Parse the command using bash-parser
    let parsed;
    try {
      parsed = parseCommand(line);
    } catch (err) {
      if (err instanceof UnsupportedSyntaxError) {
        this.stderr.write(`${err.message}\r\n`);
      } else if (err instanceof ParseError) {
        this.stderr.write(`Parse error: ${err.message}\r\n`);
      } else {
        this.stderr.write(`Error: ${err}\r\n`);
      }
      return 1;
    }

    if (!parsed) {
      return 0;
    }

    const { name: cmdName, args } = parsed;

    const commandFn = await this.resolveCommand(cmdName);
    if (!commandFn) {
      this.stderr.write(`${cmdName}: command not found\r\n`);
      return 127;
    }

    const ctx: CommandContext = {
      args,
      env: this.env,
      cwd: this.cwd,
      stdout: this.stdout,
      stderr: this.stderr,
      fs: this.fs,
      setCwd: (path: string) => { this.cwd = path; },
      onOpen: this.onOpenCallback,
    };

    try {
      const exitCode = await commandFn(ctx);
      // Store exit code in env
      this.env.set('?', String(exitCode ?? 0));
      return exitCode ?? 0;
    } catch (err) {
      this.stderr.write(`Error: ${err}\r\n`);
      this.env.set('?', '1');
      return 1;
    }
  }

  /** Internal: execute command from input and print prompt after */
  private async executeCommandFromInput(line: string): Promise<void> {
    await this.executeCommand(line);
    this.printPrompt();
  }

  /** Resolve a path relative to cwd */
  resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return this.normalizePath(path);
    }

    // Handle ~ for home directory
    if (path === '~' || path.startsWith('~/')) {
      const home = this.env.get('HOME') || '/';
      path = path === '~' ? home : home + path.slice(1);
      return this.normalizePath(path);
    }

    return this.normalizePath(`${this.cwd}/${path}`);
  }

  /** Normalize a path (resolve . and ..) */
  private normalizePath(path: string): string {
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

  private getCommandFromPath(
    mountPath: string,
    name: string,
  ): CommandEntry | null {
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
