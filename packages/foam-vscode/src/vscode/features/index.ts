import { FoamFeature } from '../../types';
import dailyNotes from './daily-notes';
import editing from './editing';
import navigation from './navigation';
import notes from './notes';
import tags from './tags';
import preview from './preview';
import graphWebview from './graph-webview';
import lint from './lint';
import ai from './ai';
import smartFolders from './smart-folders';
import whatsNew from './whats-new';
import publishHtmlPage from './publish-html-page';

export const features: FoamFeature[] = [
  whatsNew,
  dailyNotes,
  editing,
  navigation,
  notes,
  tags,
  smartFolders,
  preview,
  graphWebview,
  lint,
  ai,
  publishHtmlPage,
];
