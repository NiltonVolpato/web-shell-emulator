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
import { open } from './open';
import { emacs } from './emacs';
import { cowsayCmd } from './cowsay';

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
export { open } from './open';
export { emacs } from './emacs';
export { cowsayCmd } from './cowsay';

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
  ['open', open],
  ['emacs', emacs],
  ['cowsay', cowsayCmd],
]);
