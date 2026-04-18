import { ExtensionContext } from 'vscode';
import { Foam } from '../../../core/model/foam';
import linkDecorations from './document-decorator';
import refactor from './refactor';
import convertLinks from './convert-links';
import updateWikilinksCommand from './update-wikilinks';
import copyWithoutBracketsCommand from './copy-without-brackets';
import headingRenameProvider from './heading-rename-provider';
import blockRenameProvider from './block-rename-provider';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  await linkDecorations(context, foamPromise);
  await refactor(context, foamPromise);
  await convertLinks(context, foamPromise);
  await updateWikilinksCommand(context, foamPromise);
  await copyWithoutBracketsCommand(context);
  await headingRenameProvider(context, foamPromise);
  await blockRenameProvider(context, foamPromise);
}
