import {
  NoteLinkDefinition,
  Resource,
  ResourceLink,
  WikiLink,
  ResourceParser,
} from '../model/note';
import { isNone, isSome } from '../utils';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { IDataStore, FileDataStore, IMatcher } from '../services/datastore';
import { IDisposable } from '../common/lifecycle';
import { ResourceProvider } from '../model/provider';
import { createMarkdownParser } from './markdown-parser';

export class MarkdownResourceProvider implements ResourceProvider {
  private disposables: IDisposable[] = [];

  constructor(
    private readonly matcher: IMatcher,
    private readonly watcherInit?: (triggers: {
      onDidChange: (uri: URI) => void;
      onDidCreate: (uri: URI) => void;
      onDidDelete: (uri: URI) => void;
    }) => IDisposable[],
    private readonly parser: ResourceParser = createMarkdownParser([]),
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

    await Promise.all(
      files.map(async uri => {
        Logger.info('Found: ' + uri.toString());
        const content = await this.dataStore.read(uri);
        if (isSome(content)) {
          workspace.set(this.parser.parse(uri, content));
        }
      })
    );

    this.disposables =
      this.watcherInit?.({
        onDidChange: async uri => {
          if (this.matcher.isMatch(uri) && this.supports(uri)) {
            const content = await this.dataStore.read(uri);
            isSome(content) &&
              workspace.set(await this.parser.parse(uri, content));
          }
        },
        onDidCreate: async uri => {
          if (this.matcher.isMatch(uri) && this.supports(uri)) {
            const content = await this.dataStore.read(uri);
            isSome(content) &&
              workspace.set(await this.parser.parse(uri, content));
          }
        },
        onDidDelete: uri => {
          this.supports(uri) && workspace.delete(uri);
        },
      }) ?? [];
  }

  supports(uri: URI) {
    return uri.isMarkdown();
  }

  read(uri: URI): Promise<string | null> {
    return this.dataStore.read(uri);
  }

  async readAsMarkdown(uri: URI): Promise<string | null> {
    let content = await this.dataStore.read(uri);
    if (isSome(content) && uri.fragment) {
      const resource = this.parser.parse(uri, content);
      const section = Resource.findSection(resource, uri.fragment);
      if (isSome(section)) {
        const rows = content.split('\n');
        content = rows
          .slice(section.range.start.line, section.range.end.line)
          .join('\n');
      }
    }
    return content;
  }

  async fetch(uri: URI) {
    const content = await this.read(uri);
    return isSome(content) ? this.parser.parse(uri, content) : null;
  }

  resolveLink(
    workspace: FoamWorkspace,
    resource: Resource,
    link: ResourceLink
  ) {
    let targetUri: URI | undefined;
    switch (link.type) {
      case 'wikilink': {
        const definitionUri = resource.definitions.find(
          def => def.label === link.target
        )?.url;
        if (isSome(definitionUri)) {
          const definedUri = resource.uri.resolve(definitionUri);
          targetUri =
            workspace.find(definedUri, resource.uri)?.uri ??
            URI.placeholder(definedUri.path);
        } else {
          const [target, section] = link.target.split('#');
          targetUri =
            target === ''
              ? resource.uri
              : workspace.find(target, resource.uri)?.uri ??
                URI.placeholder(link.target);

          if (section) {
            targetUri = targetUri.withFragment(section);
          }
        }
        break;
      }
      case 'link': {
        const [target, section] = link.target.split('#');
        targetUri =
          workspace.find(target, resource.uri)?.uri ??
          URI.placeholder(resource.uri.resolve(link.target).path);
        if (section && !targetUri.isPlaceholder()) {
          targetUri = targetUri.withFragment(section);
        }
        break;
      }
    }
    return targetUri;
  }

  dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}

export function createMarkdownReferences(
  workspace: FoamWorkspace,
  noteUri: URI,
  includeExtension: boolean
): NoteLinkDefinition[] {
  const source = workspace.find(noteUri);
  // Should never occur since we're already in a file,
  if (source?.type !== 'note') {
    console.warn(
      `Note ${noteUri.toString()} note found in workspace when attempting \
to generate markdown reference list`
    );
    return [];
  }

  return source.links
    .filter(isWikilink)
    .map(link => {
      const targetUri = workspace.resolveLink(source, link);
      const target = workspace.find(targetUri);
      if (isNone(target)) {
        Logger.warn(
          `Link ${targetUri.toString()} in ${noteUri.toString()} is not valid.`
        );
        return null;
      }
      if (target.type === 'placeholder') {
        // no need to create definitions for placeholders
        return null;
      }

      let relativeUri = target.uri.relativeTo(noteUri.getDirectory());
      if (!includeExtension) {
        relativeUri = relativeUri.changeExtension('*', '');
      }

      // [wikilink-text]: path/to/file.md "Page title"
      return {
        label:
          link.rawText.indexOf('[[') > -1
            ? link.rawText.substring(2, link.rawText.length - 2)
            : link.rawText || link.label,
        url: relativeUri.path,
        title: target.title,
      };
    })
    .filter(isSome)
    .sort();
}

export function stringifyMarkdownLinkReferenceDefinition(
  definition: NoteLinkDefinition
) {
  const url =
    definition.url.indexOf(' ') > 0 ? `<${definition.url}>` : definition.url;
  let text = `[${definition.label}]: ${url}`;
  if (definition.title) {
    text = `${text} "${definition.title}"`;
  }

  return text;
}

const isWikilink = (link: ResourceLink): link is WikiLink => {
  return link.type === 'wikilink';
};
