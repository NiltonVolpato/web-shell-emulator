import { init, Terminal, FitAddon } from 'ghostty-web';
import { configure, fs, mounts, InMemory } from '@zenfs/core';
import { IndexedDB } from '@zenfs/dom';
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
    '/home/guest': IndexedDB,
    '/site': InMemory,
  },
});

// Create welcome content in home if it doesn't exist (home is persistent)
if (!fs.existsSync('/home/guest/welcome.txt')) {
  fs.mkdirSync('/home/guest/documents', { recursive: true });
  fs.writeFileSync('/home/guest/welcome.txt', 'Welcome to Web Shell!\n\nThis is a simulated Linux shell running in your browser.\nYour home directory is persistent across sessions.\n');
  fs.writeFileSync('/home/guest/documents/notes.txt', 'Some notes here...\n');
  // Create .motd (message of the day) and .profile to demonstrate profile sourcing
  fs.writeFileSync('/home/guest/.motd', '========================================\n  Message of the Day\n  Your home directory is persistent!\n  Try: ls /site\n========================================\n');
  fs.writeFileSync('/home/guest/.profile', '# Display message of the day on login\ncat ~/.motd\n');
}

// Create test site content (this would be generated at build time in production)
fs.mkdirSync('/site/blog', { recursive: true });
fs.mkdirSync('/site/projects', { recursive: true });
fs.writeFileSync('/site/about.md', '# About\n\nThis is the about page for my website.\n');
fs.writeFileSync('/site/blog/hello-world.md', '# Hello World\n\nWelcome to my first blog post!\n');
fs.writeFileSync('/site/blog/second-post.md', '# Second Post\n\nAnother great article.\n');
fs.writeFileSync('/site/projects/web-shell.md', '# Web Shell\n\nA terminal emulator for the browser.\n');

// Get browser panel elements
const browserPanel = document.getElementById('browser-panel')!;
const browserIframe = document.getElementById('browser-iframe') as HTMLIFrameElement;
const urlDisplay = document.getElementById('url-display')!;
const closeButton = document.getElementById('close-browser')!;

// Browser panel handlers
function openBrowser(url: string) {
  browserPanel.classList.add('open');
  urlDisplay.textContent = url;

  // Check if it's an external URL
  const isExternal = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('www.');

  if (isExternal) {
    // External URLs can't be loaded in iframe due to same-origin policy
    // Show a message with a link to open in new tab
    const fullUrl = url.startsWith('www.') ? 'https://' + url : url;
    browserIframe.srcdoc = `
      <html>
        <body style="font-family: system-ui; padding: 40px; background: #f5f5f5;">
          <h2>External URL</h2>
          <p>Cannot load external sites in iframe due to browser security (same-origin policy).</p>
          <p><a href="${fullUrl}" target="_blank" rel="noopener" style="color: #2563eb; font-size: 1.1em;">
            Open ${url} in new tab &rarr;
          </a></p>
        </body>
      </html>
    `;
  } else {
    // Local path - map to demo pages
    // /about -> ./pages/about.html
    // /blog/hello-world -> ./pages/blog/hello-world.html
    browserIframe.src = './pages' + url + '.html';
  }

  // Refit terminal after layout change
  setTimeout(() => fitAddon.fit(), 100);
}

function closeBrowser() {
  browserPanel.classList.remove('open');
  browserIframe.src = 'about:blank';
  // Refit terminal after layout change
  setTimeout(() => fitAddon.fit(), 100);
}

closeButton.addEventListener('click', closeBrowser);

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
// Skip empty writes and catch errors (ghostty-web has buffer bugs with certain writes)
const termOutput = {
  write: (text: string) => {
    if (!text) return; // ghostty-web throws RangeError on empty string writes
    try {
      term.write(text);
    } catch (e) {
      console.warn('Terminal write error:', e);
    }
  },
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
  onOpen: openBrowser,
});

shell.start();

// Handle window resize
window.addEventListener('resize', () => {
  fitAddon.fit();
});
