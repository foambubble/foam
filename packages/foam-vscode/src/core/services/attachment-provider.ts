import { Resource, ResourceLink } from '../model/note';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { IDataStore, IMatcher } from '../services/datastore';
import { IDisposable } from '../common/lifecycle';
import { ResourceProvider } from '../model/provider';
import { Position } from '../model/position';

const imageExtensions = ['.png', '.jpg', '.gif'];
const attachmentExtensions = ['.pdf', ...imageExtensions];

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
    source: {
      contentStart: Position.create(0, 0),
      end: Position.create(0, 0),
      eol: '\n',
      text: '',
    },
  };
};

export class AttachmentResourceProvider implements ResourceProvider {
  private disposables: IDisposable[] = [];

  constructor(
    private readonly matcher: IMatcher,
    private readonly dataStore: IDataStore,
    private readonly watcherInit?: (triggers: {
      onDidChange: (uri: URI) => void;
      onDidCreate: (uri: URI) => void;
      onDidDelete: (uri: URI) => void;
    }) => IDisposable[]
  ) {}

  async init(workspace: FoamWorkspace) {
    const filesByFolder = await Promise.all(
      this.matcher.include.map(glob =>
        this.dataStore.list(glob, this.matcher.exclude)
      )
    );
    const files = this.matcher
      .match(filesByFolder.flat())
      .filter(this.supports);

    for (const uri of files) {
      Logger.info('Found: ' + uri.toString());
      workspace.set(asResource(uri));
    }

    this.disposables =
      this.watcherInit?.({
        onDidChange: async uri => {
          if (this.matcher.isMatch(uri) && this.supports(uri)) {
            workspace.set(asResource(uri));
          }
        },
        onDidCreate: async uri => {
          if (this.matcher.isMatch(uri) && this.supports(uri)) {
            workspace.set(asResource(uri));
          }
        },
        onDidDelete: uri => {
          this.supports(uri) && workspace.delete(uri);
        },
      }) ?? [];
  }

  supports(uri: URI) {
    return attachmentExtensions.includes(uri.getExtension());
  }

  read(uri: URI): Promise<string | null> {
    return null;
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
