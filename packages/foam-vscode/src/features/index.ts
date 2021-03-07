import createReferences from './wikilink-reference-generation';
import openDailyNote from './open-daily-note';
import janitor from './janitor';
import dataviz from './dataviz';
import copyWithoutBrackets from './copy-without-brackets';
import openDatedNote from './open-dated-note';
import tagsExplorer from './tags-tree-view';
import createFromTemplate from './create-from-template';
import openRandomNote from './open-random-note';
import orphans from './orphans';
import placeholders from './placeholders';
import backlinks from './backlinks';
import utilityCommands from './utility-commands';
import { FoamFeature } from '../types';

export const features: FoamFeature[] = [
  tagsExplorer,
  createReferences,
  openDailyNote,
  openRandomNote,
  janitor,
  dataviz,
  copyWithoutBrackets,
  openDatedNote,
  createFromTemplate,
  orphans,
  placeholders,
  backlinks,
  utilityCommands,
];
