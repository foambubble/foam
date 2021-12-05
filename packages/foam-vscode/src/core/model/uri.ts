// `URI` is mostly compatible with VSCode's `Uri`.
// Having a Foam-specific URI object allows for easier maintenance of the API.
// See https://github.com/foambubble/foam/pull/537 for more context.
// Some code in this file comes from https://github.com/microsoft/vscode/main/src/vs/base/common/uri.ts
// See LICENSE for details

import * as pathUtils from '../utils/path';
import { CharCode } from '../common/charCode';

/**
 * Uniform Resource Identifier (URI) http://tools.ietf.org/html/rfc3986.
 * This class is a simple parser which creates the basic component parts
 * (http://tools.ietf.org/html/rfc3986#section-3) with minimal validation
 * and encoding.
 *
 * ```txt
 *       foo://example.com:8042/over/there?name=ferret#nose
 *       \_/   \______________/\_________/ \_________/ \__/
 *        |           |            |            |        |
 *     scheme     authority       path        query   fragment
 *        |   _____________________|__
 *       / \ /                        \
 *       urn:example:animal:ferret:nose
 * ```
 */
export interface URI {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
}

const _empty = '';
const _slash = '/';
const _regexp = /^(([^:/?#]{2,}?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;

export abstract class URI {
  static create(from: Partial<URI>): URI {
    // When using this method we assume the path is already posix
    // so we don't check whether it's a Windows path, nor we do any
    // conversion
    return {
      scheme: from.scheme ?? _empty,
      authority: from.authority ?? _empty,
      path: from.path ?? _empty,
      query: from.query ?? _empty,
      fragment: from.fragment ?? _empty,
    };
  }

  static parse(value: string): URI {
    const match = _regexp.exec(value);
    if (!match) {
      return URI.create({});
    }
    let path = percentDecode(match[5] ?? _empty);
    path = pathUtils.toUriPath(path);
    return URI.create({
      scheme: match[2] || 'file',
      authority: percentDecode(match[4] ?? _empty),
      path: path,
      query: percentDecode(match[7] ?? _empty),
      fragment: percentDecode(match[9] ?? _empty),
    });
  }

  /**
   * Parses a URI from value, taking into consideration possible relative paths.
   *
   * @param value the value to parse for a URI
   * @param baseUri the URI to use as base in case value is a relative path
   * @returns the URI from the given value. In case of a relative path, the URI will take into
   * account the base from which it is computed. If the resolved URI has no extension, it will
   * inherit the extension from the base. Any fragment will be preserved
   */
  static resolve(value: string, baseUri: URI): URI {
    let uri = URI.parse(value);
    if (uri.scheme === 'file' && !pathUtils.isAbsolute(uri.path)) {
      let [path, fragment] = value.split('#');
      if (path) {
        if (!pathUtils.getExtension(path)) {
          path += pathUtils.getExtension(baseUri.path);
        }
        path = pathUtils.joinPaths(pathUtils.getDir(baseUri.path), path);
        uri = URI.create({ ...baseUri, path: path });
      } else {
        uri = baseUri;
      }
      if (fragment) {
        uri = URI.create({ ...uri, fragment: fragment });
      }
    }
    return uri;
  }

  /**
   * Creates a file URI from a filesystem path, which may be a UNC share.
   *
   * @param path the filesystem path
   * @returns the file URI representing the given path
   */
  static file(fsPath: string): URI {
    let authority = _empty;
    if (pathUtils.isUNCShare(fsPath)) {
      [authority, fsPath] = pathUtils.parseUNCShare(fsPath);
    }
    const path = pathUtils.toUriPath(fsPath);
    return URI.create({ scheme: 'file', authority, path });
  }

  static placeholder(path: string): URI {
    return URI.create({
      scheme: 'placeholder',
      path: path,
    });
  }

  static withFragment(uri: URI, fragment: string): URI {
    return URI.create({
      ...uri,
      fragment,
    });
  }

  /**
   * Join a URI path to a series of paths.
   *
   * @param uri the input URI
   * @param paths the paths to add to the URI path
   * @returns the resulting URI
   */
  static joinPaths(uri: URI, ...paths: string[]): URI {
    if (!uri.path) {
      throw new Error(`[UriError]: cannot call join path to URI without path`);
    }
    let path = pathUtils.joinPaths(uri.path, ...paths);
    return URI.create({ ...uri, path: path });
  }

  /**
   * Returns filesystem path for a URI. This is the inverse of URI.file.
   *
   * @param uri a (presumably file) URI
   * @returns the filesystem path for the uri, it may be a UNC share
   */
  static toFsPath(uri: URI): string {
    if (uri.authority && uri.path.length > 1 && uri.scheme === 'file') {
      return `//${uri.authority}${uri.path}`;
    } else {
      return pathUtils.toFsPath(uri.path);
    }
  }

  static toString(uri: URI): string {
    return encode(uri, false);
  }

  // --- utility

  static isUri(thing: any): thing is URI {
    if (!thing) {
      return false;
    }
    return (
      typeof (thing as URI).authority === 'string' &&
      typeof (thing as URI).fragment === 'string' &&
      typeof (thing as URI).path === 'string' &&
      typeof (thing as URI).query === 'string' &&
      typeof (thing as URI).scheme === 'string'
    );
  }

  static isPlaceholder(uri: URI): boolean {
    return uri.scheme === 'placeholder';
  }

  static isEqual(a: URI, b: URI): boolean {
    return (
      a.authority === b.authority &&
      a.scheme === b.scheme &&
      a.path === b.path &&
      a.fragment === b.fragment &&
      a.query === b.query
    );
  }

  static isMarkdownFile(uri: URI): boolean {
    return uri.path.endsWith('.md');
  }
}

// --- encode / decode

function decodeURIComponentGraceful(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    if (str.length > 3) {
      return str.substr(0, 3) + decodeURIComponentGraceful(str.substr(3));
    } else {
      return str;
    }
  }
}

const _rEncodedAsHex = /(%[0-9A-Za-z][0-9A-Za-z])+/g;

function percentDecode(str: string): string {
  if (!str.match(_rEncodedAsHex)) {
    return str;
  }
  return str.replace(_rEncodedAsHex, match =>
    decodeURIComponentGraceful(match)
  );
}

/**
 * Create the external version of a uri
 */
function encode(uri: URI, skipEncoding: boolean): string {
  const encoder = !skipEncoding
    ? encodeURIComponentFast
    : encodeURIComponentMinimal;

  let res = '';
  let { scheme, authority, path, query, fragment } = uri;
  if (scheme) {
    res += scheme;
    res += ':';
  }
  if (authority || scheme === 'file') {
    res += _slash;
    res += _slash;
  }
  if (authority) {
    let idx = authority.indexOf('@');
    if (idx !== -1) {
      // <user>@<auth>
      const userinfo = authority.substr(0, idx);
      authority = authority.substr(idx + 1);
      idx = userinfo.indexOf(':');
      if (idx === -1) {
        res += encoder(userinfo, false);
      } else {
        // <user>:<pass>@<auth>
        res += encoder(userinfo.substr(0, idx), false);
        res += ':';
        res += encoder(userinfo.substr(idx + 1), false);
      }
      res += '@';
    }
    authority = authority.toLowerCase();
    idx = authority.indexOf(':');
    if (idx === -1) {
      res += encoder(authority, false);
    } else {
      // <auth>:<port>
      res += encoder(authority.substr(0, idx), false);
      res += authority.substr(idx);
    }
  }
  if (path) {
    // upper-case windows drive letters in /c:/fff or c:/fff
    if (
      path.length >= 3 &&
      path.charCodeAt(0) === CharCode.Slash &&
      path.charCodeAt(2) === CharCode.Colon
    ) {
      const code = path.charCodeAt(1);
      if (code >= CharCode.a && code <= CharCode.z) {
        path = `/${String.fromCharCode(code - 32)}:${path.substr(3)}`; // "/C:".length === 3
      }
    } else if (path.length >= 2 && path.charCodeAt(1) === CharCode.Colon) {
      const code = path.charCodeAt(0);
      if (code >= CharCode.a && code <= CharCode.z) {
        path = `${String.fromCharCode(code - 32)}:${path.substr(2)}`; // "/C:".length === 3
      }
    }
    // encode the rest of the path
    res += encoder(path, true);
  }
  if (query) {
    res += '?';
    res += encoder(query, false);
  }
  if (fragment) {
    res += '#';
    res += !skipEncoding ? encodeURIComponentFast(fragment, false) : fragment;
  }
  return res;
}

// reserved characters: https://tools.ietf.org/html/rfc3986#section-2.2
const encodeTable: { [ch: number]: string } = {
  [CharCode.Colon]: '%3A', // gen-delims
  [CharCode.Slash]: '%2F',
  [CharCode.QuestionMark]: '%3F',
  [CharCode.Hash]: '%23',
  [CharCode.OpenSquareBracket]: '%5B',
  [CharCode.CloseSquareBracket]: '%5D',
  [CharCode.AtSign]: '%40',

  [CharCode.ExclamationMark]: '%21', // sub-delims
  [CharCode.DollarSign]: '%24',
  [CharCode.Ampersand]: '%26',
  [CharCode.SingleQuote]: '%27',
  [CharCode.OpenParen]: '%28',
  [CharCode.CloseParen]: '%29',
  [CharCode.Asterisk]: '%2A',
  [CharCode.Plus]: '%2B',
  [CharCode.Comma]: '%2C',
  [CharCode.Semicolon]: '%3B',
  [CharCode.Equals]: '%3D',

  [CharCode.Space]: '%20',
};

function encodeURIComponentFast(
  uriComponent: string,
  allowSlash: boolean
): string {
  let res: string | undefined = undefined;
  let nativeEncodePos = -1;

  for (let pos = 0; pos < uriComponent.length; pos++) {
    const code = uriComponent.charCodeAt(pos);

    // unreserved characters: https://tools.ietf.org/html/rfc3986#section-2.3
    if (
      (code >= CharCode.a && code <= CharCode.z) ||
      (code >= CharCode.A && code <= CharCode.Z) ||
      (code >= CharCode.Digit0 && code <= CharCode.Digit9) ||
      code === CharCode.Dash ||
      code === CharCode.Period ||
      code === CharCode.Underline ||
      code === CharCode.Tilde ||
      (allowSlash && code === CharCode.Slash)
    ) {
      // check if we are delaying native encode
      if (nativeEncodePos !== -1) {
        res += encodeURIComponent(uriComponent.substring(nativeEncodePos, pos));
        nativeEncodePos = -1;
      }
      // check if we write into a new string (by default we try to return the param)
      if (res !== undefined) {
        res += uriComponent.charAt(pos);
      }
    } else {
      // encoding needed, we need to allocate a new string
      if (res === undefined) {
        res = uriComponent.substr(0, pos);
      }

      // check with default table first
      const escaped = encodeTable[code];
      if (escaped !== undefined) {
        // check if we are delaying native encode
        if (nativeEncodePos !== -1) {
          res += encodeURIComponent(
            uriComponent.substring(nativeEncodePos, pos)
          );
          nativeEncodePos = -1;
        }

        // append escaped variant to result
        res += escaped;
      } else if (nativeEncodePos === -1) {
        // use native encode only when needed
        nativeEncodePos = pos;
      }
    }
  }

  if (nativeEncodePos !== -1) {
    res += encodeURIComponent(uriComponent.substring(nativeEncodePos));
  }

  return res !== undefined ? res : uriComponent;
}

function encodeURIComponentMinimal(path: string): string {
  let res: string | undefined = undefined;
  for (let pos = 0; pos < path.length; pos++) {
    const code = path.charCodeAt(pos);
    if (code === CharCode.Hash || code === CharCode.QuestionMark) {
      if (res === undefined) {
        res = path.substr(0, pos);
      }
      res += encodeTable[code];
    } else {
      if (res !== undefined) {
        res += path[pos];
      }
    }
  }
  return res !== undefined ? res : path;
}
