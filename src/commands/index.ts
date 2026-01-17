import type { CommandEntry } from '../types';
import { pwd } from './pwd';
import { whoami } from './whoami';
import { echo } from './echo';
import { ls } from './ls';
import { cd } from './cd';
import { cat } from './cat';
import { mkdir } from './mkdir';
import { clear } from './clear';
import { help } from './help';

// Re-export individual commands
export { pwd } from './pwd';
export { whoami } from './whoami';
export { echo } from './echo';
export { ls } from './ls';
export { cd } from './cd';
export { cat } from './cat';
export { mkdir } from './mkdir';
export { clear } from './clear';
export { help } from './help';

/**
 * Default commands map for /bin
 */
export const defaultCommands: Map<string, CommandEntry> = new Map([
  ['pwd', pwd],
  ['whoami', whoami],
  ['echo', echo],
  ['ls', ls],
  ['cd', cd],
  ['cat', cat],
  ['mkdir', mkdir],
  ['clear', clear],
  ['help', help],
]);
