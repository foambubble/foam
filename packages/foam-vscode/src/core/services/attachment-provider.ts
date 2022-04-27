import { Resource, ResourceLink } from '../model/note';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { IDataStore, FileDataStore, IMatcher } from '../services/datastore';
import { IDisposable } from '../common/lifecycle';
import { ResourceProvider } from '../model/provider';
import { Position } from '../model/position';

const imageExtensions = ['.png', '.jpg', '.gif'];
const attachmentExtensions = ['.pdf', ...imageExtensions];

const asResource = (uri: URI): Resource => {
  return {
    uri: uri,
    title: uri.getBasename(),
    type: 'attachment',
    properties: { type: 'attachment' },
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
    private readonly watcherInit?: (triggers: {
      onDidChange: (uri: URI) => void;
      onDidCreate: (uri: URI) => void;
      onDidDelete: (uri: URI) => void;
    }) => IDisposable[],
    private readonly dataStore: IDataStore = new FileDataStore()
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

    files.map(uri => {
      Logger.info('Found: ' + uri.toString());
      workspace.set(asResource(uri));
    });

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
    return resource.uri;
  }

  dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}
