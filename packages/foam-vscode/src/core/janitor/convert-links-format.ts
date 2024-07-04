import { Resource, ResourceLink } from '../model/note';
import { URI } from '../model/uri';
import { Range } from '../model/range';
import { FoamWorkspace } from '../model/workspace';
import { isNone } from '../utils';
import { MarkdownLink } from '../services/markdown-link';

export interface LinkReplace {
  newText: string;
  range: Range /* old range */;
}

/**
 * convert a link based on its workspace and the note containing it.
 * According to targetFormat parameter to decide output format. If link.type === targetFormat, then it simply copy
 * the rawText into LinkReplace. Therefore, it's recommended to filter before conversion.
 * If targetFormat isn't supported, or the target resource pointed by link cannot be found, the function will throw
 * exception.
 * @param link
 * @param targetFormat 'wikilink' | 'link'
 * @param workspace
 * @param note
 * @returns LinkReplace { newText: string; range: Range; }
 */
export function convertLinkFormat(
  link: ResourceLink,
  targetFormat: 'wikilink' | 'link',
  workspace: FoamWorkspace,
  note: Resource | URI
): LinkReplace {
  const resource = note instanceof URI ? workspace.find(note) : note;
  const targetUri = workspace.resolveLink(resource, link);
  /* If it's already the target format or a placeholder, no transformation happens */
  if (link.type === targetFormat || targetUri.scheme === 'placeholder') {
    return {
      newText: link.rawText,
      range: link.range,
    };
  }

  let { target, section, alias } = MarkdownLink.analyzeLink(link);
  let sectionDivider = section ? '#' : '';

  if (isNone(targetUri)) {
    throw new Error(
      `Unexpected state: link to: "${link.rawText}" is not resolvable`
    );
  }

  const targetRes = workspace.find(targetUri);
  let relativeUri = targetRes.uri.relativeTo(resource.uri.getDirectory());

  if (targetFormat === 'wikilink') {
    return MarkdownLink.createUpdateLinkEdit(link, {
      target: workspace.getIdentifier(relativeUri),
      type: 'wikilink',
    });
  }

  if (targetFormat === 'link') {
    /* if alias is empty, construct one as target#section */
    if (alias === '') {
      /* in page anchor have no filename */
      if (relativeUri.getBasename() === resource.uri.getBasename()) {
        target = '';
      }
      alias = `${target}${sectionDivider}${section}`;
    }

    /* if it's originally an embedded note, the markdown link shouldn't be embedded */
    const isEmbed = targetRes.type === 'image' ? link.isEmbed : false;

    return MarkdownLink.createUpdateLinkEdit(link, {
      alias: alias,
      target: relativeUri.path,
      isEmbed: isEmbed,
      type: 'link',
    });
  }
  throw new Error(
    `Unexpected state: targetFormat: ${targetFormat} is not supported`
  );
}
