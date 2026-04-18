import { ExtensionContext } from 'vscode';
import { Foam } from '../../../core/model/foam';
import buildEmbeddingsCommand from './build-embeddings';
import showSimilarNotesCommand from './show-similar-notes';
import relatedNotes from './related-notes';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  await buildEmbeddingsCommand(context, foamPromise);
  await showSimilarNotesCommand(context, foamPromise);
  await relatedNotes(context, foamPromise);
}
