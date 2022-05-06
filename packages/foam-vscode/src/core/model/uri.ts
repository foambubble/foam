// `URI` is mostly compatible with VSCode's `Uri`.
// Having a Foam-specific URI object allows for easier maintenance of the API.
// See https://github.com/foambubble/foam/pull/537 for more context.
// Some code in this file comes from https://github.com/microsoft/vscode/main/src/vs/base/common/uri.ts
// See LICENSE for details

import { CharCode } from '../common/charCode';
import * as pathUtils from '../utils/path';

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

const _empty = '';
const _slash = '/';
const _regexp = /^(([^:/?#]{2,}?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;

export class URI {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;

  constructor(from: Partial<URI> = {}) {
    this.scheme = from.scheme ?? _empty;
    this.authority = from.authority ?? _empty;
    this.path = from.path ?? _empty; // We assume the path is already posix
    this.query = from.query ?? _empty;
    this.fragment = from.fragment ?? _empty;
  }

  static parse(value: string): URI {
    const match = _regexp.exec(value);
    if (!match) {
      return new URI();
    }
    return new URI({
      scheme: match[2] || 'file',
      authority: percentDecode(match[4] ?? _empty),
      path: pathUtils.fromFsPath(percentDecode(match[5] ?? _empty))[0],
      query: percentDecode(match[7] ?? _empty),
      fragment: percentDecode(match[9] ?? _empty),
    });
  }

  static file(value: string): URI {
    const [path, authority] = pathUtils.fromFsPath(value);
    return new URI({ scheme: 'file', authority, path });
  }

  static placeholder(path: string): URI {
    return new URI({ scheme: 'placeholder', path: path });
  }

  resolve(value: string | URI, isDirectory = false): URI {
    const uri = value instanceof URI ? value : URI.parse(value);
    if (!uri.isAbsolute()) {
      if (uri.scheme === 'file' || uri.scheme === 'placeholder') {
        let newUri = this.withFragment(uri.fragment);
        if (uri.path) {
          newUri = (isDirectory ? newUri : newUri.getDirectory())
            .joinPath(uri.path)
            .changeExtension('', this.getExtension());
        }
        return newUri;
      }
    }
    return uri;
  }

  isAbsolute(): boolean {
    return pathUtils.isAbsolute(this.path);
  }

  getDirectory(): URI {
    const path = pathUtils.getDirectory(this.path);
    return new URI({ ...this, path });
  }

  getBasename(): string {
    return pathUtils.getBasename(this.path);
  }

  getName(): string {
    return pathUtils.getName(this.path);
  }

  getExtension(): string {
    return pathUtils.getExtension(this.path);
  }

  changeExtension(from: string, to: string): URI {
    const path = pathUtils.changeExtension(this.path, from, to);
    return new URI({ ...this, path });
  }

  joinPath(...paths: string[]) {
    const path = pathUtils.joinPath(this.path, ...paths);
    return new URI({ ...this, path });
  }

  relativeTo(uri: URI) {
    const path = pathUtils.relativeTo(this.path, uri.path);
    return new URI({ ...this, path });
  }

  withFragment(fragment: string): URI {
    return new URI({ ...this, fragment });
  }

  /**
   * Returns a URI without the fragment and query information
   */
  asPlain(): URI {
    return new URI({ ...this, fragment: '', query: '' });
  }

  isPlaceholder(): boolean {
    return this.scheme === 'placeholder';
  }

  toFsPath() {
    return pathUtils.toFsPath(
      this.path,
      this.scheme === 'file' ? this.authority : ''
    );
  }

  toString(): string {
    return encode(this, false);
  }

  isMarkdown(): boolean {
    const ext = this.getExtension();
    return ext === '.md' || ext === '.markdown';
  }

  isEqual(uri: URI): boolean {
    return (
      this.authority === uri.authority &&
      this.scheme === uri.scheme &&
      this.path === uri.path &&
      this.fragment === uri.fragment &&
      this.query === uri.query
    );
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
  // eslint-disable-next-line prefer-const
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
