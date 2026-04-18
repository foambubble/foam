import { FoamFeature } from '../../types';
import dailyNotes from './daily-notes';
import editing from './editing';
import navigation from './navigation';
import notes from './notes';
import tags from './tags';
import preview from './preview';
import graphWebview from './graph-webview';
import wikilinkDiagnostics from '../../janitor/vscode/wikilink-diagnostics';
import janitorCommand from '../../janitor/vscode/commands';
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
  wikilinkDiagnostics,
  janitorCommand,
  showSimilarNotesCommand,
  buildEmbeddingsCommand,
  relatedNotes,
];
