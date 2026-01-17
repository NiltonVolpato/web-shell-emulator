import { init, Terminal, FitAddon } from 'ghostty-web';
import { configure, fs, mounts, InMemory } from '@zenfs/core';
import { Shell } from '../src/shell';
import { BinFS } from '../src/backends/binfs';
import { defaultCommands } from '../src/commands';

// Initialize ghostty-web WASM
await init();

// Configure filesystem
await configure({
  mounts: {
    '/': InMemory,
    '/bin': { backend: BinFS, commands: defaultCommands },
  },
});

// Create home directory
fs.mkdirSync('/home/guest', { recursive: true });

// Create terminal
const term = new Terminal({
  fontSize: 14,
  fontFamily: 'Monaco, Menlo, monospace',
  scrollback: 5000,
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

const container = document.querySelector<HTMLDivElement>('#terminal')!;
term.open(container);
fitAddon.fit();

// Adapter: Terminal -> ShellOutput
const termOutput = {
  write: (text: string) => term.write(text),
};

// Create and start shell
const shell = new Shell({
  fs,
  mounts,
  stdout: termOutput,
  stderr: termOutput,
  onInput: (handler) => {
    term.onData(handler);
  },
});

shell.start();

// Handle window resize
window.addEventListener('resize', () => {
  fitAddon.fit();
});
