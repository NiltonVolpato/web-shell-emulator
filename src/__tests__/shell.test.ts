import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configure, fs, mounts, InMemory, umount } from '@zenfs/core';
import { Shell } from '../shell';
import { BinFS } from '../backends/binfs';
import { StringOutput } from '../testing';
import { defaultCommands } from '../commands/index';

describe('Shell', () => {
  let stdout: StringOutput;
  let stderr: StringOutput;
  let shell: Shell;

  afterEach(() => {
    // Unmount all mounts to clean up
    for (const path of [...mounts.keys()]) {
      try {
        umount(path);
      } catch {
        // Ignore errors during cleanup
      }
    }
  });

  beforeEach(async () => {
    stdout = new StringOutput();
    stderr = new StringOutput();

    // Reset filesystem with BinFS for commands
    await configure({
      mounts: {
        '/': InMemory,
        '/bin': {
          backend: BinFS,
          commands: defaultCommands,
        },
      },
    });

    // Create test directory structure
    fs.mkdirSync('/home/guest', { recursive: true });
    fs.mkdirSync('/site', { recursive: true });
    fs.mkdirSync('/shared', { recursive: true });
    fs.writeFileSync('/site/index.md', '# Home');
    fs.writeFileSync('/site/about.md', '# About');
    fs.writeFileSync('/shared/data.txt', 'data');

    shell = new Shell({
      fs,
      mounts,
      stdout,
      stderr,
      colorLevel: 0, // Disable colors for easier testing
    });
  });

  describe('tab completion', () => {
    it('completes command names', () => {
      shell.handleInput('pw\t');
      const output = stdout.toString();
      expect(output).toContain('pwd '); // should complete to pwd
    });

    it('completes file paths in current directory', async () => {
      // First cd to /site
      await shell.executeCommand('cd /site');
      stdout.clear();

      // Type "ls ind" and press tab
      shell.handleInput('ls ind\t');
      const output = stdout.toString();
      expect(output).toContain('index.md');
    });

    it('completes absolute paths starting with /', () => {
      // Type "ls /s" and press tab - should show options (site and shared)
      shell.handleInput('ls /s\t');
      const output = stdout.toString();
      // Should show both matches since there are two
      expect(output).toContain('site/');
      expect(output).toContain('shared/');
    });

    it('completes single match for absolute path /si', () => {
      // Type "ls /si" then clear, then press tab
      shell.handleInput('ls /si');
      stdout.clear(); // Clear the echoed input
      shell.handleInput('\t');
      const output = stdout.toString();
      // Should complete the rest: "te/"
      expect(output).toBe('te/');
    });

    it('does not corrupt path when completing /si to /site/', () => {
      // Simulate typing "ls /si" then pressing tab
      shell.handleInput('ls /si');
      stdout.clear(); // Clear the echoed input
      shell.handleInput('\t');
      // The completion should add "te/" not corrupt the path
      const output = stdout.toString();
      expect(output).toBe('te/');
    });

    it('completes paths with multiple segments', () => {
      // Create nested structure
      fs.mkdirSync('/site/pages', { recursive: true });
      fs.writeFileSync('/site/pages/contact.md', '# Contact');

      // Type "ls /site/pa" then clear, then press tab
      shell.handleInput('ls /site/pa');
      stdout.clear();
      shell.handleInput('\t');
      const output = stdout.toString();
      // Should complete to "ges/"
      expect(output).toBe('ges/');
    });

    it('handles completion when there are no matches', () => {
      shell.handleInput('ls /xyz');
      stdout.clear();
      shell.handleInput('\t');
      const output = stdout.toString();
      // Should output nothing (no matches)
      expect(output).toBe('');
    });

    it('completes files in nested directories', () => {
      shell.handleInput('cat /site/ind');
      stdout.clear();
      shell.handleInput('\t');
      const output = stdout.toString();
      expect(output).toBe('ex.md');
    });
  });
});
