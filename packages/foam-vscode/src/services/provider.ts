import {
  MarkdownResourceProvider,
  Resource,
  ResourceProvider,
} from 'foam-core';
import * as vscode from 'vscode';
import {
  formatMarkdownTooltip,
  formatSimpleTooltip,
  stripFrontMatter,
  stripImages,
} from '../utils';

export const STABLE_MARKDOWN_STRING_API_VERSION = '1.52.1';

export interface VsCodeAwareFoamProvider extends ResourceProvider {
  getResourceTooltip(resource: Resource): Promise<string>;
  getTreeItemIcon(resource: Resource): string;
}

export class VsCodeFoamMarkdownProvider extends MarkdownResourceProvider
  implements VsCodeAwareFoamProvider {
  async getResourceTooltip(resource: Resource): Promise<string> {
    const content = await this.read(resource.uri);
    const strippedContent = stripFrontMatter(stripImages(content));

    return vscode.version >= STABLE_MARKDOWN_STRING_API_VERSION
      ? (formatMarkdownTooltip(strippedContent) as any)
      : formatSimpleTooltip(strippedContent);
  }

  getTreeItemIcon(resource: Resource): string {
    return 'note';
  }
}
