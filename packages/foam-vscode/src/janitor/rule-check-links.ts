import { Block, Resource, ResourceLink } from '../core/model/note';
import { Range } from '../core/model/range';
import { FoamWorkspace } from '../core/model/workspace';
import { MarkdownLink } from '../core/services/markdown-link';
import { LintIssue } from './janitor';
import { isNone } from '../core/utils';

export const AMBIGUOUS_IDENTIFIER_CODE = 'ambiguous-identifier';
export const UNKNOWN_SECTION_CODE = 'unknown-section';
export const UNKNOWN_BLOCK_CODE = 'unknown-block';
export const DUPLICATE_BLOCK_ID_CODE = 'duplicate-block-id';

/**
 * Checks all wikilinks in a resource for semantic issues:
 * - ambiguous identifiers (multiple targets)
 * - unknown sections
 * - unknown block anchors
 *
 * Returns LintIssue[] with no `fix` (these require human judgment).
 * `relatedInfo` carries candidate targets/sections/blocks for the VS Code adapter
 * to surface as code actions.
 */
export function checkLinks(
  resource: Resource,
  workspace: FoamWorkspace
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const link of resource.links) {
    if (link.type !== 'wikilink') {
      continue;
    }

    const { target, section, blockId } = MarkdownLink.analyzeLink(link);
    const targets = workspace.listByIdentifier(target);

    if (targets.length > 1) {
      issues.push({
        code: AMBIGUOUS_IDENTIFIER_CODE,
        message: 'Resource identifier is ambiguous',
        range: link.range,
        relatedInfo: targets.map(t => ({
          uri: t.uri,
          range: Range.create(0, 0, 0, 0),
          message: `Possible target: ${t.uri.path}`,
        })),
      });
    }

    if (section && targets.length === 1) {
      const target = targets[0];
      if (isNone(Resource.findSection(target, section))) {
        issues.push({
          code: UNKNOWN_SECTION_CODE,
          message: `Cannot find section "${section}" in document, available sections are:`,
          range: getFragmentRange(link, section),
          relatedInfo: target.sections.map(s => ({
            uri: target.uri,
            range: s.range,
            message: s.label,
          })),
        });
      }
    }

    if (blockId && targets.length === 1) {
      const target = targets[0];
      if (isNone(Resource.findBlock(target, blockId))) {
        issues.push({
          code: UNKNOWN_BLOCK_CODE,
          message: `Cannot find block "^${blockId}" in document, available blocks are:`,
          range: getFragmentRange(link, `^${blockId}`),
          relatedInfo: target.blocks.map(b => ({
            uri: target.uri,
            range: b.markerRange,
            message: `^${b.id}`,
          })),
        });
      }
    }
  }

  return issues;
}

/**
 * Checks a resource for duplicate block IDs within the same document.
 * Returns LintIssue[] with no `fix`.
 */
export function checkDuplicateBlocks(resource: Resource): LintIssue[] {
  const issues: LintIssue[] = [];
  const blocksByID = new Map<string, Block[]>();

  for (const block of resource.blocks) {
    if (!blocksByID.has(block.id)) {
      blocksByID.set(block.id, []);
    }
    blocksByID.get(block.id)!.push(block);
  }

  for (const [id, blocks] of blocksByID) {
    if (blocks.length < 2) {
      continue;
    }
    // Only flag duplicates (2nd occurrence onwards); the first is fine.
    for (const block of blocks.slice(1)) {
      issues.push({
        code: DUPLICATE_BLOCK_ID_CODE,
        message: `Duplicate block ID "^${id}" - ignored`,
        range: block.markerRange,
        relatedInfo: blocks
          .filter(b => b !== block)
          .map(b => ({
            uri: resource.uri,
            range: b.markerRange,
            message: `Other occurrence of "^${id}"`,
          })),
      });
    }
  }

  return issues;
}

/**
 * Returns the range covering `#fragment` within a wikilink's raw text.
 * Starts at `#` and ends immediately after the fragment, before any `|` or `]]`.
 */
function getFragmentRange(link: ResourceLink, fragment: string): Range {
  const hashPos = link.rawText.indexOf('#');
  if (hashPos < 0) {
    return Range.create(
      link.range.end.line,
      link.range.end.character,
      link.range.end.line,
      link.range.end.character
    );
  }
  return Range.create(
    link.range.start.line,
    link.range.start.character + hashPos,
    link.range.end.line,
    link.range.start.character + hashPos + 1 + fragment.length
  );
}
