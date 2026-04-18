import { FoamFeature } from '../../types';
import dailyNotes from './daily-notes';
import editing from './editing';
import navigation from './navigation';
import notes from './notes';
import tags from './tags';
import preview from './preview';
import graphWebview from './graph-webview';
import janitor from './janitor';
import ai from './ai';
import whatsNew from './whats-new';

export const features: FoamFeature[] = [
  whatsNew,
  dailyNotes,
  editing,
  navigation,
  notes,
  tags,
  preview,
  graphWebview,
  janitor,
  ai,
];
