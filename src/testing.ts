import type { ShellOutput } from './types';

/**
 * A ShellOutput implementation that captures output to a string buffer.
 * Useful for testing shell commands without a real terminal.
 */
export class StringOutput implements ShellOutput {
  private buffer: string[] = [];

  write(text: string): void {
    this.buffer.push(text);
  }

  toString(): string {
    return this.buffer.join('');
  }

  clear(): void {
    this.buffer = [];
  }

  /** Get the raw buffer array (useful for debugging) */
  getBuffer(): readonly string[] {
    return this.buffer;
  }
}
