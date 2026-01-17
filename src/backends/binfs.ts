import { InMemory } from '@zenfs/core';
import type { StoreFS } from '@zenfs/core/backends/store/fs.js';
import type { InMemoryStore } from '@zenfs/core/backends/memory.js';
import type { Backend } from '@zenfs/core/backends/backend.js';
import type { CommandEntry } from '../types';

// WeakMap to store command functions for each BinFS instance
const commandStores = new WeakMap<StoreFS<InMemoryStore>, Map<string, CommandEntry>>();

/**
 * Get the command function for a file in a BinFS filesystem
 */
export function getCommand(fs: StoreFS<InMemoryStore>, name: string): CommandEntry | undefined {
  const commands = commandStores.get(fs);
  return commands?.get(name);
}

/**
 * Check if a filesystem is a BinFS instance
 */
export function isBinFS(fs: unknown): fs is StoreFS<InMemoryStore> {
  return commandStores.has(fs as StoreFS<InMemoryStore>);
}

/**
 * Options for BinFS backend
 */
export interface BinFSOptions {
  /** Map of command names to their implementations */
  commands: Map<string, CommandEntry>;
}

/**
 * BinFS - A filesystem backend for executable commands
 *
 * Creates an in-memory filesystem where each entry corresponds to a command.
 * The actual command functions are stored separately and can be retrieved
 * using getCommand().
 *
 * Usage:
 * ```ts
 * await configure({
 *   mounts: {
 *     '/bin': {
 *       backend: BinFS,
 *       commands: new Map([['ls', lsCommand], ['pwd', pwdCommand]])
 *     }
 *   }
 * });
 * ```
 */
export const BinFS: Backend<StoreFS<InMemoryStore>, BinFSOptions> = {
  name: 'BinFS',
  options: {
    commands: {
      type: 'Map',
      required: true,
    },
  },
  create({ commands }) {
    // Create the underlying InMemory filesystem
    const fs = InMemory.create({});

    // Store the commands map for this filesystem instance
    commandStores.set(fs, commands);

    // Create a file for each command
    for (const name of commands.keys()) {
      // Create an empty executable file for each command
      // The file content doesn't matter - it's just a marker
      fs.createFileSync(`/${name}`, { mode: 0o755, uid: 0, gid: 0 });
    }

    return fs;
  },
};
