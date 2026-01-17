import { describe, it, expect, beforeEach } from 'vitest';
import { configure, fs, InMemory } from '@zenfs/core';
import { StringOutput } from '../testing';
import type { CommandContext } from '../types';
import { pwd } from '../commands/pwd';
import { whoami } from '../commands/whoami';
import { echo } from '../commands/echo';
import { ls } from '../commands/ls';
import { cat } from '../commands/cat';
import { cd } from '../commands/cd';
import { mkdir } from '../commands/mkdir';
import { clear } from '../commands/clear';
import { help } from '../commands/help';

describe('commands', () => {
  let stdout: StringOutput;
  let stderr: StringOutput;
  let cwd: string;

  function createContext(args: string[] = []): CommandContext {
    return {
      args,
      env: new Map([
        ['HOME', '/home/guest'],
        ['USER', 'guest'],
      ]),
      cwd,
      stdout,
      stderr,
      fs,
      setCwd: (path: string) => { cwd = path; },
    };
  }

  beforeEach(async () => {
    stdout = new StringOutput();
    stderr = new StringOutput();
    cwd = '/home/guest';

    // Reset filesystem
    await configure({
      mounts: {
        '/': InMemory,
      },
    });

    // Create test directory structure
    fs.mkdirSync('/home/guest', { recursive: true });
    fs.mkdirSync('/home/guest/docs', { recursive: true });
    fs.writeFileSync('/home/guest/file.txt', 'Hello, World!\n');
    fs.writeFileSync('/home/guest/docs/notes.txt', 'Some notes\n');
  });

  describe('pwd', () => {
    it('prints the current working directory', () => {
      pwd(createContext());
      expect(stdout.toString()).toBe('/home/guest\r\n');
    });

    it('prints root directory', () => {
      cwd = '/';
      pwd(createContext());
      expect(stdout.toString()).toBe('/\r\n');
    });
  });

  describe('whoami', () => {
    it('prints the current user', () => {
      whoami(createContext());
      expect(stdout.toString()).toBe('guest\r\n');
    });
  });

  describe('echo', () => {
    it('prints arguments joined by space', () => {
      echo(createContext(['hello', 'world']));
      expect(stdout.toString()).toBe('hello world\r\n');
    });

    it('prints empty line for no arguments', () => {
      echo(createContext([]));
      expect(stdout.toString()).toBe('\r\n');
    });

    it('converts \\n to \\r\\n', () => {
      echo(createContext(['hello\nworld']));
      expect(stdout.toString()).toBe('hello\r\nworld\r\n');
    });
  });

  describe('ls', () => {
    it('lists current directory by default', () => {
      ls(createContext());
      const output = stdout.toString();
      expect(output).toContain('docs/');
      expect(output).toContain('file.txt');
    });

    it('lists specified directory', () => {
      ls(createContext(['docs']));
      const output = stdout.toString();
      expect(output).toContain('notes.txt');
    });

    it('returns error for non-existent path', () => {
      const exitCode = ls(createContext(['nonexistent']));
      expect(exitCode).toBe(1);
      expect(stderr.toString()).toContain('No such file or directory');
    });
  });

  describe('cat', () => {
    it('prints file contents', () => {
      cat(createContext(['file.txt']));
      expect(stdout.toString()).toBe('Hello, World!\r\n');
    });

    it('returns error for non-existent file', () => {
      const exitCode = cat(createContext(['nonexistent.txt']));
      expect(exitCode).toBe(1);
      expect(stderr.toString()).toContain('No such file or directory');
    });

    it('returns error for directory', () => {
      const exitCode = cat(createContext(['docs']));
      expect(exitCode).toBe(1);
      expect(stderr.toString()).toContain('Is a directory');
    });

    it('returns error when no file specified', () => {
      const exitCode = cat(createContext([]));
      expect(exitCode).toBe(1);
      expect(stderr.toString()).toContain('missing file operand');
    });
  });

  describe('cd', () => {
    it('changes to specified directory', () => {
      cd(createContext(['docs']));
      expect(cwd).toBe('/home/guest/docs');
    });

    it('changes to home directory when no args', () => {
      cwd = '/';
      cd(createContext([]));
      expect(cwd).toBe('/home/guest');
    });

    it('handles absolute paths', () => {
      cd(createContext(['/home']));
      expect(cwd).toBe('/home');
    });

    it('handles .. in paths', () => {
      cd(createContext(['..']));
      expect(cwd).toBe('/home');
    });

    it('returns error for non-existent directory', () => {
      const exitCode = cd(createContext(['nonexistent']));
      expect(exitCode).toBe(1);
      expect(stderr.toString()).toContain('No such file or directory');
      expect(cwd).toBe('/home/guest'); // unchanged
    });

    it('returns error for file (not directory)', () => {
      const exitCode = cd(createContext(['file.txt']));
      expect(exitCode).toBe(1);
      expect(stderr.toString()).toContain('Not a directory');
    });

    it('handles cd -', () => {
      // First cd to docs
      const ctx = createContext(['docs']);
      cd(ctx);
      expect(cwd).toBe('/home/guest/docs');

      // OLDPWD should now be set to previous directory
      const ctx2 = createContext(['-']);
      ctx2.env = ctx.env; // Share env to get OLDPWD
      cd(ctx2);
      expect(cwd).toBe('/home/guest'); // Back to original
    });
  });

  describe('mkdir', () => {
    it('creates a directory', () => {
      mkdir(createContext(['newdir']));
      expect(fs.existsSync('/home/guest/newdir')).toBe(true);
      expect(fs.statSync('/home/guest/newdir').isDirectory()).toBe(true);
    });

    it('creates nested directories', () => {
      mkdir(createContext(['a/b/c']));
      expect(fs.existsSync('/home/guest/a/b/c')).toBe(true);
    });

    it('returns error when no operand', () => {
      const exitCode = mkdir(createContext([]));
      expect(exitCode).toBe(1);
      expect(stderr.toString()).toContain('missing operand');
    });
  });

  describe('clear', () => {
    it('outputs clear screen escape sequence', () => {
      clear(createContext());
      expect(stdout.toString()).toBe('\x1b[2J\x1b[H');
    });
  });

  describe('help', () => {
    it('outputs help text', () => {
      help(createContext());
      const output = stdout.toString();
      expect(output).toContain('Available commands');
      expect(output).toContain('pwd');
      expect(output).toContain('ls');
      expect(output).toContain('cd');
    });
  });
});
