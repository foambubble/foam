
import createReferences from './wikilink-reference-generation';
import createWikiDocumentLinkProvider from './wiki-document-link-provider';
import { FoamFeature } from '../types'

export const features: FoamFeature[] = [
  createReferences,
  createWikiDocumentLinkProvider
];
