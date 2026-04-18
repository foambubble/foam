import { FoamFeature } from '../../types';
import dailyNotes from './daily-notes';
import editing from './editing';
import navigation from './navigation';
import notes from './notes';
import tags from './tags';
import preview from './preview';
import graphWebview from './graph-webview';
import janitor from './janitor';
import showSimilarNotesCommand from '../../ai/vscode/commands/show-similar-notes';
import buildEmbeddingsCommand from '../../ai/vscode/commands/build-embeddings';
import relatedNotes from '../../ai/vscode/panels/related-notes';

export const features: FoamFeature[] = [
  dailyNotes,
  editing,
  navigation,
  notes,
  tags,
  preview,
  graphWebview,
  janitor,
  showSimilarNotesCommand,
  buildEmbeddingsCommand,
  relatedNotes,
];
