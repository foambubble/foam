// Some code in this file coming from https://github.com/microsoft/vscode/
// See LICENSE for details

import * as paths from 'path';
import { CharCode } from '../common/charCode';
import { isWindows } from '../common/platform';

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

const { posix } = paths;
const _empty = '';
const _slash = '/';
const _regexp = /^(([^:/?#]{2,}?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;

export abstract class URI {
  static create(from: Partial<URI>): URI {
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
    return URI.create({
      scheme: match[2] || 'file',
      authority: percentDecode(match[4] ?? _empty),
      path: percentDecode(match[5] ?? _empty),
      query: percentDecode(match[7] ?? _empty),
      fragment: percentDecode(match[9] ?? _empty),
    });
  }

  /**
   * Parses a URI from value, taking into consideration possible relative paths.
   *
   * @param reference the URI to use as reference in case value is a relative path
   * @param value the value to parse for a URI
   * @returns the URI from the given value. In case of a relative path, the URI will take into account
   * the reference from which it is computed
   */
  static resolve(value: string, reference: URI): URI {
    let uri = URI.parse(value);
    if (uri.scheme === 'file' && !value.startsWith('/')) {
      const [path, fragment] = value.split('#');
      uri =
        path.length > 0 ? URI.computeRelativeURI(reference, path) : reference;
      if (fragment) {
        uri = URI.create({
          ...uri,
          fragment: fragment,
        });
      }
    }
    return uri;
  }

  static computeRelativeURI(reference: URI, relativeSlug: string): URI {
    // if no extension is provided, use the same extension as the source file
    const slug =
      posix.extname(relativeSlug) !== ''
        ? relativeSlug
        : `${relativeSlug}${posix.extname(reference.path)}`;
    return URI.create({
      ...reference,
      path: posix.join(posix.dirname(reference.path), slug),
    });
  }

  static file(path: string): URI {
    let authority = _empty;

    // normalize to fwd-slashes on windows,
    // on other systems bwd-slashes are valid
    // filename character, eg /f\oo/ba\r.txt
    if (isWindows) {
      if (path.startsWith(_slash)) {
        path = `${path.replace(/\\/g, _slash)}`;
      } else {
        path = `/${path.replace(/\\/g, _slash)}`;
      }
    }

    // check for authority as used in UNC shares
    // or use the path as given
    if (path[0] === _slash && path[1] === _slash) {
      const idx = path.indexOf(_slash, 2);
      if (idx === -1) {
        authority = path.substring(2);
        path = _slash;
      } else {
        authority = path.substring(2, idx);
        path = path.substring(idx) || _slash;
      }
    }

    return URI.create({ scheme: 'file', authority, path });
  }

  static placeholder(key: string): URI {
    return URI.create({
      scheme: 'placeholder',
      path: key,
    });
  }

  static relativePath(source: URI, target: URI): string {
    const relativePath = posix.relative(
      posix.dirname(source.path),
      target.path
    );
    return relativePath;
  }

  static getBasename(uri: URI) {
    return posix.parse(uri.path).name;
  }

  static getDir(uri: URI) {
    return URI.file(posix.dirname(uri.path));
  }

  /**
   * Uses a placeholder URI, and a reference directory, to generate
   * the URI of the corresponding resource
   *
   * @param placeholderUri the placeholder URI
   * @param basedir the dir to be used as reference
   * @returns the target resource URI
   */
  static createResourceUriFromPlaceholder(
    basedir: URI,
    placeholderUri: URI
  ): URI {
    const tokens = placeholderUri.path.split('/');
    const path = tokens.slice(0, -1);
    const filename = tokens.slice(-1);
    return URI.joinPath(basedir, ...path, `${filename}.md`);
  }

  /**
   * Join a URI path with path fragments and normalizes the resulting path.
   *
   * @param uri The input URI.
   * @param pathFragment The path fragment to add to the URI path.
   * @returns The resulting URI.
   */
  static joinPath(uri: URI, ...pathFragment: string[]): URI {
    if (!uri.path) {
      throw new Error(`[UriError]: cannot call joinPath on URI without path`);
    }
    let newPath: string;
    if (isWindows && uri.scheme === 'file') {
      newPath = URI.file(paths.win32.join(URI.toFsPath(uri), ...pathFragment))
        .path;
    } else {
      newPath = paths.posix.join(uri.path, ...pathFragment);
    }
    return URI.create({ ...uri, path: newPath });
  }

  static toFsPath(uri: URI, keepDriveLetterCasing = true): string {
    let value: string;
    if (uri.authority && uri.path.length > 1 && uri.scheme === 'file') {
      // unc path: file://shares/c$/far/boo
      value = `//${uri.authority}${uri.path}`;
    } else if (
      uri.path.charCodeAt(0) === CharCode.Slash &&
      ((uri.path.charCodeAt(1) >= CharCode.A &&
        uri.path.charCodeAt(1) <= CharCode.Z) ||
        (uri.path.charCodeAt(1) >= CharCode.a &&
          uri.path.charCodeAt(1) <= CharCode.z)) &&
      uri.path.charCodeAt(2) === CharCode.Colon
    ) {
      if (!keepDriveLetterCasing) {
        // windows drive letter: file:///c:/far/boo
        value = uri.path[1].toLowerCase() + uri.path.substr(2);
      } else {
        value = uri.path.substr(1);
      }
    } else {
      // other path
      value = uri.path;
    }
    if (isWindows) {
      value = value.replace(/\//g, '\\');
    }
    return value;
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
    return uri.path.endsWith('md');
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
    // lower-case windows drive letters in /C:/fff or C:/fff
    if (
      path.length >= 3 &&
      path.charCodeAt(0) === CharCode.Slash &&
      path.charCodeAt(2) === CharCode.Colon
    ) {
      const code = path.charCodeAt(1);
      if (code >= CharCode.A && code <= CharCode.Z) {
        path = `/${String.fromCharCode(code + 32)}:${path.substr(3)}`; // "/c:".length === 3
      }
    } else if (path.length >= 2 && path.charCodeAt(1) === CharCode.Colon) {
      const code = path.charCodeAt(0);
      if (code >= CharCode.A && code <= CharCode.Z) {
        path = `${String.fromCharCode(code + 32)}:${path.substr(2)}`; // "/c:".length === 3
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
