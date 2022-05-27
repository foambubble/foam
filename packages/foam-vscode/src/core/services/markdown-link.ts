import { ResourceLink } from '../model/note';

export abstract class MarkdownLink {
  private static wikilinkRegex = new RegExp(
    /\[\[([^#|]+[^\\|#])?#?([^|]+[^\\|])?(\\\||\|)?(.*)?\]\]/
  );

  private static directLinkRegex = new RegExp(
    /\[(.*)\]\(([^#]*)?#?([^\]]+)?\)/
  );

  public static analyzeLink(link: ResourceLink) {
    try {
      if (link.type === 'wikilink') {
        const [
          ,
          target,
          section,
          aliasDivider,
          alias,
        ] = this.wikilinkRegex.exec(link.rawText);

        return {
          rawTarget: target,
          target: target?.replace(/\\/g, '') ?? '',
          section: section ?? '',
          aliasDivider: aliasDivider ?? '',
          alias: alias ?? '',
        };
      }
      if (link.type === 'link') {
        const [, alias, target, section] = this.directLinkRegex.exec(
          link.rawText
        );
        return {
          target: target ?? '',
          section: section ?? '',
          alias: alias ?? '',
        };
      }
      throw new Error(`Link of type ${link.type} is not supported`);
    } catch (e) {
      throw new Error(`Couldn't parse link ${link.rawText} - ${e}`);
    }
  }

  public static createUpdateLinkEdit(
    link: ResourceLink,
    delta: { target?: string; section?: string; alias?: string }
  ) {
    const { target, section, alias, aliasDivider } = MarkdownLink.analyzeLink(
      link
    );

    const newTarget = delta.target ?? target;
    const newSection = delta.section ?? section ?? '';
    const newAlias = delta.alias ?? alias ?? '';
    const sectionDivider = newSection ? '#' : '';
    const newAliasDivider = aliasDivider || (newAlias ? '|' : '');

    if (link.type === 'wikilink') {
      return {
        newText: `[[${newTarget}${sectionDivider}${newSection}${newAliasDivider}${newAlias}]]`,
        selection: link.range,
      };
    }
    if (link.type === 'link') {
      return {
        newText: `[${newAlias}](${newTarget}${sectionDivider}${newSection})`,
        selection: link.range,
      };
    }
    throw new Error(
      `Unexpected state: link of type ${link.type} is not supported`
    );
  }
}
