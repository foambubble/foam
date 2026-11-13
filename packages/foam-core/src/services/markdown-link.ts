import { ResourceLink } from '../model/note';
import { Range } from '../model/range';
import { URI } from '../model/uri';
import { TextEdit } from './text-edit';

/**
 * Splits `[[target#section|alias]]`. The wikilink runs from the first `[[` to
 * the last `]]`; the target stops at the first `#` or `|`, the section at the
 * first `|`. A pipe escaped as `\|`, as inside a table, splits the same way.
 */
function parseWikilink(text: string) {
  const open = text.indexOf('[[');
  const close = text.lastIndexOf(']]');
  if (open < 0 || close < open + 2) {
    return undefined;
  }
  const inner = text.slice(open + 2, close);
  const pipe = inner.indexOf('|');
  const escapedPipe = pipe > 0 && inner[pipe - 1] === '\\';
  const reference =
    pipe < 0 ? inner : inner.slice(0, escapedPipe ? pipe - 1 : pipe);
  const hash = reference.indexOf('#');
  return {
    target: hash < 0 ? reference : reference.slice(0, hash),
    section: hash < 0 ? '' : reference.slice(hash + 1),
    /** Offset of `target` in `text` */
    targetOffset: open + 2,
    /** Offset of `section` in `text`, -1 without a `#` */
    sectionOffset: hash < 0 ? -1 : open + 2 + hash + 1,
    alias: pipe < 0 ? '' : inner.slice(pipe + 1),
    escapedPipe,
  };
}

/** A title after the url, as in `[a](path "Title")` */
const TITLE_SUFFIX = /\s+(?:"[^"]*"|'[^']*')$/;

/**
 * Splits `[alias](target#section "title")`, the url optionally within angle
 * brackets and the whole optionally an embed. The alias runs to the LAST
 * `](`, so an image whose alt text holds a link reports the image rather
 * than the link inside it.
 *
 * Done by hand rather than by one pattern: matching alias and url together
 * means retrying the url at every `](` the alias could end at, which is
 * quadratic on text holding a long run of them.
 */
function parseDirectLink(text: string) {
  const open = text.startsWith('![') ? 1 : 0;
  // A link whose text wraps is left alone: every offset below is a column on
  // the line the link starts at
  if (text[open] !== '[' || !text.endsWith(')') || text.includes('\n')) {
    return undefined;
  }
  const divider = text.lastIndexOf('](');
  if (divider < open) {
    return undefined;
  }
  let url = text.slice(divider + 2, text.length - 1);
  /** Offset of `url` in `text` */
  let urlOffset = divider + 2;
  if (url.startsWith('<')) {
    const close = url.indexOf('>');
    if (close < 0) {
      return undefined;
    }
    url = url.slice(1, close);
    urlOffset += 1;
  } else {
    url = url.replace(TITLE_SUFFIX, '');
  }
  const hash = url.indexOf('#');
  return {
    alias: text.slice(open + 1, divider),
    target: hash < 0 ? url : url.slice(0, hash),
    section: hash < 0 ? '' : url.slice(hash + 1),
    /** Offset of `section` in `text`, -1 without a `#` */
    sectionOffset: hash < 0 ? -1 : urlOffset + hash + 1,
  };
}

export abstract class MarkdownLink {
  /** A link Foam parses lies on one line, so an offset into it is a column */
  private static rangeOf(link: ResourceLink, span: [number, number]): Range {
    const { line, character } = link.range.start;
    return Range.create(line, character + span[0], line, character + span[1]);
  }

  public static analyzeLink(link: ResourceLink) {
    try {
      if (link.type === 'wikilink') {
        // Wikilinks are always parsed from rawText. Any resolved definition is a
        // Foam-generated rendering artifact, not authoritative content — the user's
        // intent is expressed by the wikilink identifier itself.
        const wikilink = parseWikilink(link.rawText);
        if (!wikilink) {
          throw new Error('No wikilink found');
        }
        const { target, section, alias } = wikilink;
        // A fragment starting with ^ is a block anchor (e.g. #^myblock), not a section
        const blockMatch = section.match(/^\^([a-zA-Z0-9-]+)$/);
        return {
          target: target.replace(/\\/g, ''),
          section: blockMatch ? '' : section,
          blockId: blockMatch?.[1] ?? '',
          alias,
        };
      }
      if (link.type === 'external') {
        const url =
          typeof link.definition === 'string'
            ? link.definition
            : ResourceLink.isResolvedReference(link)
              ? link.definition.url
              : link.rawText;
        return { target: url, section: '', blockId: '', alias: '' };
      }
      if (link.type === 'link') {
        // For reference-style links with resolved definitions, parse target and section from definition URL
        if (ResourceLink.isResolvedReference(link)) {
          // Extract alias from rawText for reference-style links
          const referenceMatch = /^\[([^\]]*)\]/.exec(link.rawText);
          const alias = referenceMatch ? referenceMatch[1] : '';

          // Parse target and section from definition URL
          const definitionUri = URI.parse(link.definition.url, 'tmp');
          const defFragment = definitionUri.fragment;
          const defBlockMatch = defFragment?.match(/^\^([a-zA-Z0-9-]+)$/);
          return {
            target: definitionUri.path, // Base path from definition
            section: defBlockMatch ? '' : defFragment ?? '',
            blockId: defBlockMatch?.[1] ?? '',
            alias: alias, // Alias from rawText
          };
        }

        const parsed = parseDirectLink(link.rawText);
        if (!parsed) {
          // This might be a reference-style link that wasn't resolved
          // Try to extract just the alias text for reference-style links
          const referenceMatch = /^\[([^\]]*)\]/.exec(link.rawText);
          const alias = referenceMatch ? referenceMatch[1] : '';
          return {
            target: '',
            section: '',
            blockId: '',
            alias: alias,
          };
        }
        const { alias, target, section } = parsed;
        const blockMatch = section?.match(/^\^([a-zA-Z0-9-]+)$/);
        return {
          target,
          section: blockMatch ? '' : section,
          blockId: blockMatch?.[1] ?? '',
          alias: alias ?? '',
        };
      }
      throw new Error(`Link of type ${link.type} is not supported`);
    } catch (e) {
      throw new Error(`Couldn't parse link ${link.rawText} - ${e}`);
    }
  }

  /**
   * Range of `section` in `[[target#section|alias]]`, block anchors included.
   * Undefined for other link types and for wikilinks without a section.
   */
  public static getSectionRange(link: ResourceLink): Range | undefined {
    const span = MarkdownLink.getSectionSpan(link);
    return span ? MarkdownLink.rangeOf(link, span) : undefined;
  }

  /**
   * Range of `target` in `[[target#section|alias]]`. Undefined for other link
   * types and for a wikilink naming a section of the note it sits in.
   */
  public static getTargetRange(link: ResourceLink): Range | undefined {
    if (link.type !== 'wikilink') {
      return undefined;
    }
    const wikilink = parseWikilink(link.rawText);
    if (!wikilink?.target) {
      return undefined;
    }
    return MarkdownLink.rangeOf(link, [
      wikilink.targetOffset,
      wikilink.targetOffset + wikilink.target.length,
    ]);
  }

  /** Where the fragment starts and ends within `link.rawText` */
  private static getSectionSpan(
    link: ResourceLink
  ): [number, number] | undefined {
    if (link.type === 'wikilink') {
      const wikilink = parseWikilink(link.rawText);
      return wikilink?.section
        ? [
            wikilink.sectionOffset,
            wikilink.sectionOffset + wikilink.section.length,
          ]
        : undefined;
    }
    if (link.type !== 'link') {
      return undefined;
    }
    // A reference-style link keeps its url in a definition elsewhere, so it
    // has no fragment of its own to point at.
    const parsed = parseDirectLink(link.rawText);
    return parsed && parsed.sectionOffset >= 0
      ? [parsed.sectionOffset, parsed.sectionOffset + parsed.section.length]
      : undefined;
  }

  public static createUpdateLinkEdit(
    link: ResourceLink,
    delta: {
      target?: string;
      section?: string;
      alias?: string;
      type?: 'wikilink' | 'link';
      isEmbed?: boolean;
    }
  ): TextEdit {
    if (link.type === 'external') {
      throw new Error('Cannot update an external link');
    }
    const { target, section, blockId, alias } = MarkdownLink.analyzeLink(link);
    const newTarget = delta.target ?? target;
    // Preserve the existing fragment (section or block anchor) when not overriding.
    const existingFragment = blockId ? `^${blockId}` : section;
    const newSection = delta.section ?? existingFragment ?? '';
    const newAlias = delta.alias ?? alias ?? '';
    const sectionDivider = newSection ? '#' : '';
    const pipe =
      link.type === 'wikilink' && parseWikilink(link.rawText)?.escapedPipe
        ? '\\|'
        : '|';
    const aliasDivider = newAlias ? pipe : '';
    const embed = delta.isEmbed ?? link.isEmbed ? '!' : '';
    const type = delta.type ?? link.type;
    if (type === 'wikilink') {
      return {
        newText: `${embed}[[${newTarget}${sectionDivider}${newSection}${aliasDivider}${newAlias}]]`,
        range: link.range,
      };
    }
    if (type === 'link') {
      const defaultAlias = () => {
        return `${newTarget}${sectionDivider}${newSection}`;
      };
      const useAngles =
        newTarget.includes(' ') || newSection.includes(' ');
      return {
        newText: `${embed}[${newAlias ? newAlias : defaultAlias()}](${
          useAngles ? '<' : ''
        }${newTarget}${sectionDivider}${newSection}${useAngles ? '>' : ''})`,
        range: link.range,
      };
    }
    throw new Error(`Unexpected state: link of type ${type} is not supported`);
  }
}
