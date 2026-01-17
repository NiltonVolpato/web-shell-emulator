import { describe, it, expect } from 'vitest';
import { parseCommand, UnsupportedSyntaxError, ParseError } from '../parser';

describe('parseCommand', () => {
  describe('basic parsing', () => {
    it('returns null for empty input', () => {
      expect(parseCommand('')).toBeNull();
      expect(parseCommand('   ')).toBeNull();
    });

    it('parses a single command with no arguments', () => {
      expect(parseCommand('ls')).toEqual({ name: 'ls', args: [] });
      expect(parseCommand('pwd')).toEqual({ name: 'pwd', args: [] });
    });

    it('parses a command with arguments', () => {
      expect(parseCommand('echo hello')).toEqual({ name: 'echo', args: ['hello'] });
      expect(parseCommand('ls -la /home')).toEqual({ name: 'ls', args: ['-la', '/home'] });
    });

    it('handles multiple spaces between arguments', () => {
      expect(parseCommand('echo    hello    world')).toEqual({
        name: 'echo',
        args: ['hello', 'world']
      });
    });

    it('trims leading and trailing whitespace', () => {
      expect(parseCommand('  ls  ')).toEqual({ name: 'ls', args: [] });
    });
  });

  describe('quoted strings', () => {
    it('parses double-quoted strings', () => {
      expect(parseCommand('echo "hello world"')).toEqual({
        name: 'echo',
        args: ['hello world']
      });
    });

    it('parses single-quoted strings', () => {
      expect(parseCommand("echo 'hello world'")).toEqual({
        name: 'echo',
        args: ['hello world']
      });
    });

    it('handles mixed quotes', () => {
      expect(parseCommand('echo "hello" \'world\'')).toEqual({
        name: 'echo',
        args: ['hello', 'world']
      });
    });

    it('handles quotes within different quotes', () => {
      expect(parseCommand('echo "it\'s great"')).toEqual({
        name: 'echo',
        args: ["it's great"]
      });
      expect(parseCommand("echo 'say \"hello\"'")).toEqual({
        name: 'echo',
        args: ['say "hello"']
      });
    });

    it('handles empty quoted strings', () => {
      expect(parseCommand('echo ""')).toEqual({ name: 'echo', args: [''] });
      expect(parseCommand("echo ''")).toEqual({ name: 'echo', args: [''] });
    });

    it('handles adjacent quoted strings', () => {
      expect(parseCommand('echo "hello""world"')).toEqual({
        name: 'echo',
        args: ['helloworld']
      });
    });
  });

  describe('escape sequences', () => {
    it('handles escape sequences in double quotes', () => {
      expect(parseCommand('echo "hello\\nworld"')).toEqual({
        name: 'echo',
        args: ['hello\nworld']
      });
      expect(parseCommand('echo "hello\\tworld"')).toEqual({
        name: 'echo',
        args: ['hello\tworld']
      });
      expect(parseCommand('echo "hello\\rworld"')).toEqual({
        name: 'echo',
        args: ['hello\rworld']
      });
    });

    it('handles escaped quotes in double quotes', () => {
      expect(parseCommand('echo "say \\"hello\\""')).toEqual({
        name: 'echo',
        args: ['say "hello"']
      });
    });

    it('handles escaped backslash', () => {
      expect(parseCommand('echo "back\\\\slash"')).toEqual({
        name: 'echo',
        args: ['back\\slash']
      });
    });

    it('preserves backslash in single quotes', () => {
      expect(parseCommand("echo 'hello\\nworld'")).toEqual({
        name: 'echo',
        args: ['hello\\nworld']
      });
    });

    it('handles backslash escaping outside quotes', () => {
      expect(parseCommand('echo hello\\ world')).toEqual({
        name: 'echo',
        args: ['hello world']
      });
    });
  });

  describe('unsupported syntax', () => {
    it('throws on pipes', () => {
      expect(() => parseCommand('ls | grep foo')).toThrow(UnsupportedSyntaxError);
      expect(() => parseCommand('ls | grep foo')).toThrow('pipes (|)');
    });

    it('throws on redirections', () => {
      expect(() => parseCommand('echo hello > file.txt')).toThrow(UnsupportedSyntaxError);
      expect(() => parseCommand('cat < file.txt')).toThrow(UnsupportedSyntaxError);
    });

    it('throws on logical AND', () => {
      expect(() => parseCommand('cmd1 && cmd2')).toThrow(UnsupportedSyntaxError);
      expect(() => parseCommand('cmd1 && cmd2')).toThrow('logical AND');
    });

    it('throws on semicolon', () => {
      expect(() => parseCommand('cmd1; cmd2')).toThrow(UnsupportedSyntaxError);
      expect(() => parseCommand('cmd1; cmd2')).toThrow('command chaining');
    });

    it('throws on command substitution', () => {
      expect(() => parseCommand('echo $(pwd)')).toThrow(UnsupportedSyntaxError);
      expect(() => parseCommand('echo `pwd`')).toThrow(UnsupportedSyntaxError);
    });

    it('does NOT throw on operators inside quotes', () => {
      expect(parseCommand('echo "hello | world"')).toEqual({
        name: 'echo',
        args: ['hello | world']
      });
      expect(parseCommand('echo "a && b"')).toEqual({
        name: 'echo',
        args: ['a && b']
      });
    });
  });

  describe('parse errors', () => {
    it('throws on unterminated double quote', () => {
      expect(() => parseCommand('echo "hello')).toThrow(ParseError);
      expect(() => parseCommand('echo "hello')).toThrow('Unterminated double quote');
    });

    it('throws on unterminated single quote', () => {
      expect(() => parseCommand("echo 'hello")).toThrow(ParseError);
      expect(() => parseCommand("echo 'hello")).toThrow('Unterminated single quote');
    });
  });
});
