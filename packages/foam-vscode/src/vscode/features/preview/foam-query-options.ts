/*global markdownit:readonly*/

import { Resource } from '@foam/core';
import { ResourceParser } from '@foam/core';
import { SourceReader } from '@foam/core';
import { RenderContext } from '@foam/core';

/**
 * Options for both the production and web-extension flavours of
 * `markdownItFoamQuery`. Shared so a typo in one branch breaks the other at
 * type-check time. The web twin ignores `readSource` / `parser` /
 * `createInnerMd` since none of them work in the browser host.
 */
export interface FoamQueryOptions {
  isTrusted: () => boolean;
  toRelativePath: (path: string) => string;
  getCurrentResource?: () => Resource | null;

  /**
   * Fresh markdown-it carrying the full Foam pipeline, used to render
   * source-derived cells without re-entering the outer `md`.
   */
  createInnerMd?: () => markdownit;

  /**
   * Source reader for source-derived fields
   */
  readSource?: SourceReader;

  /**
   * Parser used to find links inside source-derived cells so they can be
   * rewritten to absolute workspace paths.
   */
  parser?: ResourceParser;

  /**
   * Shared cycle-detection stack. Pass the same instance into the embed
   * plugin too — otherwise embed↔query cycles aren't caught.
   */
  renderContext: RenderContext;
}
