import { init, Terminal, FitAddon } from 'ghostty-web';
import { configure, fs, mounts, InMemory } from '@zenfs/core';
import { Shell } from '../src/shell';
import { BinFS } from '../src/backends/binfs';
import { defaultCommands } from '../src/commands/index';

// Initialize ghostty-web WASM
await init();

// Configure filesystem
await configure({
  mounts: {
    '/': InMemory,
    '/bin': { backend: BinFS, commands: defaultCommands },
  },
});

// Create home directory and some sample content
fs.mkdirSync('/home/guest', { recursive: true });
fs.mkdirSync('/home/guest/documents', { recursive: true });
fs.writeFileSync('/home/guest/welcome.txt', 'Welcome to Web Terminal!\n\nThis is a simulated Linux shell running in your browser.\n');
fs.writeFileSync('/home/guest/documents/notes.txt', 'Some notes here...\n');

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
