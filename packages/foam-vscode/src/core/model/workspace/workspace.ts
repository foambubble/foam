import { TrieMap } from 'mnemonist';
import { URI } from '../uri';
import { isSome } from '../../utils';
import { isAbsolute } from 'path';
import { changeExtension, getExtension } from '../../utils/path';

export class Workspace<T extends { uri: URI }> {
  protected _items: TrieMap<string, T> = new TrieMap();
  public defaultExtension: string;

  public getTrieIdentifier() {
    return new TrieIdentifier<T>(this._items, this.defaultExtension);
  }

  public list(): T[] {
    return Array.from(this._items.values());
  }

  public get = (uri: URI): T => {
    const note = this.find(uri);
    if (isSome(note)) {
      return note;
    } else {
      throw new Error('Item not found: ' + uri.path);
    }
  };

  public find(reference: URI | string, baseUri?: URI): T | null {
    const trieIdentifier = this.getTrieIdentifier();
    if (reference instanceof URI) {
      return this._items.get(trieIdentifier.get(reference)) ?? null;
    }
    let item: T | null = null;
    const [path, fragment] = (reference as string).split('#');
    if (TrieIdentifier.isIdentifier(path)) {
      item = trieIdentifier.listByIdentifier(path)[0];
    } else {
      const candidates = [path, path + this.defaultExtension];
      for (const candidate of candidates) {
        const searchKey = isAbsolute(candidate)
          ? candidate
          : isSome(baseUri)
          ? baseUri.resolve(candidate).path
          : null;
        item = this._items.get(trieIdentifier.get(searchKey));
        if (item) {
          break;
        }
      }
    }
    if (item && fragment) {
      item = {
        ...item,
        uri: item.uri.with({ fragment: fragment }),
      };
    }
    return item ?? null;
  }
}

export class TrieIdentifier<T extends { uri: URI }> {
  constructor(
    private trieMap: TrieMap<string, T> = new TrieMap(),
    public defaultExtension: string = '.md'
  ) {}

  /**
   * Returns the minimal identifier for the given item
   *
   * @param forItem the item to compute the identifier for
   */
  public getIdentifier = (forItem: URI, exclude?: URI[]): string => {
    const amongst = [];
    const basename = forItem.getBasename();

    this.listByIdentifier(basename).map(res => {
      // skip self
      if (res.uri.isEqual(forItem)) {
        return;
      }

      // skip exclude list
      if (exclude && exclude.find(ex => ex.isEqual(res.uri))) {
        return;
      }
      amongst.push(res.uri);
    });

    let identifier = TrieIdentifier.getShortest(
      forItem.path,
      amongst.map(uri => uri.path)
    );
    identifier = changeExtension(identifier, this.defaultExtension, '');
    if (forItem.fragment) {
      identifier += `#${forItem.fragment}`;
    }
    return identifier;
  };

  public listByIdentifier(identifier: string): T[] {
    let needle = this.get(identifier);

    const mdNeedle =
      getExtension(normalize(identifier)) !== this.defaultExtension
        ? this.get(identifier + this.defaultExtension)
        : undefined;

    let items: T[] = [];

    this.trieMap.find(needle).forEach(elm => items.push(elm[1]));

    if (mdNeedle) {
      this.trieMap.find(mdNeedle).forEach(elm => items.push(elm[1]));
    }

    // if multiple resources found, try to filter exact case matches
    if (items.length > 1) {
      items = items.filter(
        r =>
          r.uri.getBasename() === identifier ||
          r.uri.getBasename() === identifier + this.defaultExtension
      );
    }

    return items.sort((a, b) => a.uri.path.localeCompare(b.uri.path));
  }

  /**
   * Returns a note identifier in reversed order. Used to optimise the storage of notes in
   * the workspace to optimise retrieval of notes.
   *
   * @param reference the URI path to reverse
   */
  public get(reference: URI | string): string {
    let path: string;
    if (reference instanceof URI) {
      path = (reference as URI).path;
    } else {
      path = reference as string;
    }

    let reversedPath = normalize(path).split('/').reverse().join('/');

    if (reversedPath.indexOf('/') < 0) {
      reversedPath = reversedPath + '/';
    }

    return reversedPath;
  }

  /**
   * Returns the minimal identifier for the given string amongst others
   *
   * @param forPath the value to compute the identifier for
   * @param amongst the set of strings within which to find the identifier
   */
  static getShortest(forPath: string, amongst: string[]): string {
    const needleTokens = forPath.split('/').reverse();
    const haystack = amongst
      .filter(value => value !== forPath)
      .map(value => value.split('/').reverse());

    let tokenIndex = 0;
    let res = needleTokens;
    while (tokenIndex < needleTokens.length) {
      for (let j = haystack.length - 1; j >= 0; j--) {
        if (
          haystack[j].length < tokenIndex ||
          needleTokens[tokenIndex] !== haystack[j][tokenIndex]
        ) {
          haystack.splice(j, 1);
        }
      }
      if (haystack.length === 0) {
        res = needleTokens.splice(0, tokenIndex + 1);
        break;
      }
      tokenIndex++;
    }
    const identifier = res
      .filter(token => token.trim() !== '')
      .reverse()
      .join('/');

    return identifier;
  }

  static isIdentifier(path: string): boolean {
    return !(
      path.startsWith('/') ||
      path.startsWith('./') ||
      path.startsWith('../')
    );
  }
}

const normalize = (v: string) => v.toLocaleLowerCase();
