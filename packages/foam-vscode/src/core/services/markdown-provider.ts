import {
  NoteLinkDefinition,
  Resource,
  ResourceLink,
  ResourceParser,
} from '../model/note';
import { isNone, isSome } from '../utils';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { IDisposable } from '../common/lifecycle';
import { ResourceProvider } from '../model/provider';
import { MarkdownLink } from './markdown-link';
import { IDataStore } from './datastore';
import { uniqBy } from 'lodash';

export class MarkdownResourceProvider implements ResourceProvider {
  private disposables: IDisposable[] = [];

  constructor(
    private readonly dataStore: IDataStore,
    private readonly parser: ResourceParser,
    public readonly noteExtensions: string[] = ['.md']
  ) {}

  supports(uri: URI) {
    return this.noteExtensions.includes(uri.getExtension());
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
    const content = await this.dataStore.read(uri);
    return isSome(content) ? this.parser.parse(uri, content) : null;
  }

  resolveLink(
    workspace: FoamWorkspace,
    resource: Resource,
    link: ResourceLink
  ) {
    let targetUri: URI | undefined;
    const { target, section } = MarkdownLink.analyzeLink(link);
    switch (link.type) {
      case 'wikilink': {
        if (ResourceLink.isResolvedReference(link)) {
          const definedUri = resource.uri.resolve(link.definition.url);
          targetUri =
            workspace.find(definedUri, resource.uri)?.uri ??
            URI.placeholder(definedUri.path);
          if (definedUri.fragment) {
            targetUri = targetUri.with({ fragment: definedUri.fragment });
          }
        } else {
          targetUri =
            target === ''
              ? resource.uri
              : workspace.find(target, resource.uri)?.uri ??
                URI.placeholder(target);
          if (section) {
            targetUri = targetUri.with({ fragment: section });
          }
        }
        break;
      }
      case 'link': {
        if (ResourceLink.isUnresolvedReference(link)) {
          // Reference-style link with unresolved reference - treat as placeholder
          targetUri = URI.placeholder(link.definition);
          break;
        }

        // Handle reference-style links first
        const targetPath = ResourceLink.isResolvedReference(link)
          ? link.definition.url
          : target;

        let path: string;

        if (targetPath.startsWith('/')) {
          targetUri =
            workspace.find(targetPath, resource.uri)?.uri ??
            URI.placeholder(workspace.resolveUri(targetPath).path);
        } else {
          // Handle relative paths and non-root paths
          path =
            targetPath.startsWith('./') || targetPath.startsWith('../')
              ? targetPath
              : './' + targetPath;
          targetUri =
            workspace.find(path, resource.uri)?.uri ??
            URI.placeholder(resource.uri.resolve(path).path);
        }

        if (section && !targetUri.isPlaceholder()) {
          targetUri = targetUri.with({ fragment: section });
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
  source: Resource | URI,
  includeExtension: boolean
): NoteLinkDefinition[] {
  const resource = source instanceof URI ? workspace.find(source) : source;

  const definitions = resource.links
    .filter(link => ResourceLink.isReferenceStyleLink(link))
    .map(link => {
      if (ResourceLink.isResolvedReference(link)) {
        return link.definition;
      }

      const targetUri = workspace.resolveLink(resource, link);
      const target = workspace.find(targetUri);
      if (isNone(target)) {
        Logger.warn(
          `Link ${targetUri.toString()} in ${resource.uri.toString()} is not valid.`
        );
        return null;
      }
      if (target.type === 'placeholder') {
        // no need to create definitions for placeholders
        return null;
      }

      // Special handling for same-file section links (e.g., [[#section]])
      if (target.uri.isEqual(resource.uri) && targetUri.fragment) {
        return {
          label: link.rawText.substring(
            link.isEmbed ? 3 : 2,
            link.rawText.length - 2
          ),
          url: `#${targetUri.fragment}`,
          title: target.title,
        };
      }

      let relativeUri = target.uri.relativeTo(resource.uri.getDirectory());
      if (
        !includeExtension &&
        relativeUri.path.endsWith(workspace.defaultExtension)
      ) {
        relativeUri = relativeUri.changeExtension('*', '');
      }

      // Extract base path and link name separately.
      const basePath = relativeUri.path.split('/').slice(0, -1).join('/');
      const linkName = relativeUri.path.split('/').pop();

      const encodedURL = encodeURIComponent(linkName).replace(/%20/g, ' ');

      // [wikilink-text]: path/to/file.md "Page title"
      // Build the base URL
      let url = `${basePath ? basePath + '/' : ''}${encodedURL}`;

      // Append fragment from targetUri if it exists
      if (targetUri.fragment) {
        url += `#${targetUri.fragment}`;
      }

      // [wikilink-text]: path/to/file.md#section "Page title"
      return {
        // embedded looks like ![[note-a]]
        // regular note looks like [[note-a]]
        label: link.rawText.substring(
          link.isEmbed ? 3 : 2,
          link.rawText.length - 2
        ),
        url: url,
        title: target.title,
      };
    })
    .filter(isSome)
    .sort();
  return uniqBy(definitions, def => NoteLinkDefinition.format(def));
}
