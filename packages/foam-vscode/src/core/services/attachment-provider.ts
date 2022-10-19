import { Resource, ResourceLink } from '../model/note';
import { URI } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { IDisposable } from '../common/lifecycle';
import { ResourceProvider } from '../model/provider';
import { getFoamVsCodeConfig } from '../../services/config';

const attachmentExtConfig = getFoamVsCodeConfig(
  'files.attachmentExtensions',
  ''
)
  .split(' ')
  .map(ext => '.' + ext.trim());

const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
const attachmentExtensions = [...attachmentExtConfig, ...imageExtensions];

const asResource = (uri: URI): Resource => {
  const type = imageExtensions.includes(uri.getExtension())
    ? 'image'
    : 'attachment';
  return {
    uri: uri,
    title: uri.getBasename(),
    type: type,
    aliases: [],
    properties: { type: type },
    sections: [],
    links: [],
    tags: [],
    definitions: [],
  };
};

export class AttachmentResourceProvider implements ResourceProvider {
  private disposables: IDisposable[] = [];

  supports(uri: URI) {
    return attachmentExtensions.includes(
      uri.getExtension().toLocaleLowerCase()
    );
  }

  async readAsMarkdown(uri: URI): Promise<string | null> {
    if (imageExtensions.includes(uri.getExtension())) {
      return `![${''}](${uri.toString()}|height=200)`;
    }
    return `### ${uri.getBasename()}`;
  }

  async fetch(uri: URI) {
    return asResource(uri);
  }

  resolveLink(w: FoamWorkspace, resource: Resource, l: ResourceLink) {
    throw new Error('not supported');
    // Silly workaround to make VS Code and es-lint happy
    // eslint-disable-next-line
    return resource.uri;
  }

  dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}
