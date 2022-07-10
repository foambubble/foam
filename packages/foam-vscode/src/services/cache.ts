import { ExtensionContext } from 'vscode';
import { Resource } from '../core/model/note';
import { URI } from '../core/model/uri';
import { ParserCache } from '../core/services/markdown-parser';
import { Logger } from '../core/utils/log';

/**
 * This is a best effort implementation to cache resources.
 * It's not a perfect solution, but it's a good start.
 *
 * We use the URI and a checksum of the markdown file to cache the resource.
 */
export class VsCodeBasedParserCache implements ParserCache {
  private static CACHE_NAME = 'foam-cache';
  private _cache: { [key: string]: [string, Resource] };

  constructor(private context: ExtensionContext) {
    this._cache = context.workspaceState.get(
      VsCodeBasedParserCache.CACHE_NAME,
      {}
    );
    Logger.info('Cache size: ' + Object.keys(this._cache).length);
  }

  get(uri: URI): [string, Resource] {
    const result = this._cache[uri.toString()];
    if (result) {
      // The cache returns a plain object, but we need an actual
      // instance of URI in the resource (we check instanceof in the code),
      // so to be sure we convert it here.
      const [checksum, resource] = result;
      const rehydrated = {
        ...resource,
        uri: new URI(resource.uri),
      };
      return [checksum, rehydrated];
    }
    return undefined;
  }

  has(uri: URI): boolean {
    return uri.toString() in this._cache;
  }

  set(uri: URI, data: [string, Resource]): void {
    this._cache[uri.toString()] = data;
    this.context.workspaceState.update(
      VsCodeBasedParserCache.CACHE_NAME,
      this._cache
    );
  }

  del(uri: URI): void {
    delete this._cache[uri.toString()];
  }

  clear(): void {
    this._cache = {};
    this.context.workspaceState.update(
      VsCodeBasedParserCache.CACHE_NAME,
      this._cache
    );
  }
}
