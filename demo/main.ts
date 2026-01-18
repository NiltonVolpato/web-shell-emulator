import { init, Terminal, FitAddon } from "ghostty-web";
import { configure, fs, mounts, InMemory } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
import { Shell } from "../src/shell";
import { BinFS } from "../src/backends/binfs";
import { defaultCommands } from "../src/commands/index";
// @ts-expect-error - Ymacs has no type definitions
import { Ymacs, Ymacs_Buffer, Ymacs_Keymap, Ymacs_Interactive } from "./ymacs/ymacs.mjs";

// Initialize ghostty-web WASM
await init();

// Configure filesystem
await configure({
  mounts: {
    "/": InMemory,
    "/bin": { backend: BinFS, commands: defaultCommands },
    "/home/guest": IndexedDB,
    "/site": InMemory,
  },
});

// Create welcome content in home if it doesn't exist (home is persistent)
if (!fs.existsSync("/home/guest/welcome.txt")) {
  fs.mkdirSync("/home/guest/documents", { recursive: true });
  fs.writeFileSync(
    "/home/guest/welcome.txt",
    "Welcome to Web Shell!\n\nThis is a simulated Linux shell running in your browser.\nYour home directory is persistent across sessions.\n",
  );
  fs.writeFileSync("/home/guest/documents/notes.txt", "Some notes here...\n");
  // Create .motd (message of the day) and .profile to demonstrate profile sourcing
  fs.writeFileSync(
    "/home/guest/.motd",
    "========================================\n  Message of the Day\n  Your home directory is persistent!\n  Try: ls /site\n========================================\n",
  );
  fs.writeFileSync(
    "/home/guest/.profile",
    "# Display message of the day on login\ncat ~/.motd\n",
  );
}

// Create test site content (this would be generated at build time in production)
fs.mkdirSync("/site/blog", { recursive: true });
fs.mkdirSync("/site/projects", { recursive: true });
fs.writeFileSync(
  "/site/about.md",
  "# About\n\nThis is the about page for my website.\n",
);
fs.writeFileSync(
  "/site/blog/hello-world.md",
  "# Hello World\n\nWelcome to my first blog post!\n",
);
fs.writeFileSync(
  "/site/blog/second-post.md",
  "# Second Post\n\nAnother great article.\n",
);
fs.writeFileSync(
  "/site/projects/web-shell.md",
  "# Web Shell\n\nA terminal emulator for the browser.\n",
);

// Get browser panel elements
const browserPanel = document.getElementById("browser-panel")!;
const browserIframe = document.getElementById(
  "browser-iframe",
) as HTMLIFrameElement;
const urlDisplay = document.getElementById("url-display")!;
const closeButton = document.getElementById("close-browser")!;

// Browser panel handlers
function openBrowser(url: string) {
  console.log("[openBrowser] Called with URL:", url);
  browserPanel.classList.add("open");
  urlDisplay.textContent = url;

  // Local path - map to demo pages
  // /about -> ./pages/about.html
  // /blog/hello-world -> ./pages/blog/hello-world.html
  browserIframe.src = "./pages" + url + ".html";

  // Refit terminal after layout change
  setTimeout(() => fitAddon.fit(), 100);
}

function closeBrowser() {
  browserPanel.classList.remove("open");
  browserIframe.src = "about:blank";
  // Refit terminal after layout change
  setTimeout(() => fitAddon.fit(), 100);
}

closeButton.addEventListener("click", closeBrowser);

// Get emacs panel elements
const emacsPanel = document.getElementById("emacs-panel")!;
const ymacsContainer = document.getElementById("ymacs-container")!;
const fileDisplay = document.getElementById("file-display")!;
const closeEmacsButton = document.getElementById("close-emacs")!;

// Initialize Ymacs
const ymacs = new Ymacs({ buffers: [] });
ymacs.addClass("Ymacs-line-numbers");
ymacs.setColorTheme("standard-dark");
ymacsContainer.appendChild(ymacs.getElement());

// Hook up Ymacs filesystem methods to ZenFS
Ymacs.prototype.fs_setFileContents = function(
  name: string,
  content: string,
  stamp: string | false,
  cont: (result: string | null) => void
) {
  if (stamp) {
    // Check if file changed since we read it
    try {
      const currentContent = fs.readFileSync(name, "utf-8");
      if (currentContent !== stamp) {
        cont(null);
        return;
      }
    } catch {
      // File doesn't exist, that's ok
    }
  }
  try {
    // Ensure parent directory exists
    const dir = name.replace(/\/[^/]+$/, "");
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(name, content);
    cont(content);
  } catch (e) {
    console.error("Failed to save file:", e);
    this.getActiveBuffer().signalInfo("Can't save file");
  }
};

Ymacs.prototype.fs_getFileContents = function(
  name: string,
  nothrow: boolean,
  cont: (content: string | null, stamp: string | null) => void
) {
  try {
    const stat = fs.statSync(name);
    if (!stat.isFile()) {
      cont(null, null);
      return;
    }
    const content = fs.readFileSync(name, "utf-8");
    cont(content, content);
  } catch {
    if (!nothrow) {
      this.getActiveBuffer().signalInfo("File not found");
    }
    cont(null, null);
  }
};

Ymacs.prototype.fs_fileType = function(
  name: string,
  cont: (isFile: boolean | null) => void
) {
  try {
    const stat = fs.statSync(name);
    cont(stat.isFile() ? true : null);
  } catch {
    cont(true); // Assume it's a new file
  }
};

Ymacs.prototype.fs_getDirectory = function(
  dir: string,
  cont: (result: Record<string, { type: string }>) => void
) {
  try {
    const entries = fs.readdirSync(dir);
    const result: Record<string, { type: string }> = {};
    for (const entry of entries) {
      try {
        const stat = fs.statSync(`${dir}/${entry}`);
        result[entry] = { type: stat.isFile() ? "file" : "directory" };
      } catch {
        // Skip entries we can't stat
      }
    }
    cont(result);
  } catch {
    cont({});
  }
};

Ymacs.prototype.fs_normalizePath = function(path: string) {
  return path;
};

// Emacs panel handlers
function openEmacs(path: string) {
  console.log("[openEmacs] Called with path:", path);

  // Close browser panel if open
  closeBrowser();

  emacsPanel.classList.add("open");
  fileDisplay.textContent = path || "(new file)";

  // Focus terminal first to ensure proper state
  term.focus();

  if (path) {
    // Open the file in Ymacs
    const buf = ymacs.getActiveBuffer();
    if (buf) {
      buf.cmd("find_file", path);
    }
  }

  // Focus Ymacs after a short delay
  setTimeout(() => {
    ymacs.focus();
  }, 100);

  // Refit terminal after layout change
  setTimeout(() => fitAddon.fit(), 100);
}

function closeEmacs() {
  emacsPanel.classList.remove("open");
  term.focus();
  // Refit terminal after layout change
  setTimeout(() => fitAddon.fit(), 100);
}

closeEmacsButton.addEventListener("click", closeEmacs);

// Override Ymacs exit command to close the panel
Ymacs_Buffer.newCommands({
  exit: Ymacs_Interactive(function() {
    closeEmacs();
  })
});

// Create a keymap with C-x C-c bound to exit
const exitKeymap = Ymacs_Keymap.define("exit_keymap", {
  "C-x C-c": "exit"
});

// Push the keymap to all buffers when they're created
ymacs.addEventListener("onCreateBuffer", (buf: typeof Ymacs_Buffer) => {
  buf.pushKeymap(exitKeymap);
});

// Create terminal
const term = new Terminal({
  fontSize: 14,
  fontFamily: "Monaco, Menlo, monospace",
  scrollback: 5000,
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

const container = document.querySelector<HTMLDivElement>("#terminal")!;
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
      console.warn("Terminal write error:", e);
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
  onEmacs: openEmacs,
  env: new Map([
    ["PATH", "/bin:/usr/bin"],
    ["HOME", "/home/guest"],
    ["USER", "guest"],
    ["SITE_URL", window.location.origin], // e.g., http://localhost:5173
  ]),
});

shell.start();

// Handle window resize
window.addEventListener("resize", () => {
  fitAddon.fit();
});
