import { FoamWorkspace } from '../../core/model/workspace';

export const markdownItRemoveLinkReferences = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  md.inline.ruler.before('link', 'clear-references', state => {
    if (state.env.references) {
      const src = state.src.toLowerCase();
      const foamLinkRegEx = /\[\[([^[\]]+?)\]\]/g;
      const foamLinks = [...src.matchAll(foamLinkRegEx)].map(m =>
        m[1].toLowerCase()
      );

      Object.keys(state.env.references).forEach(refKey => {
        // Remove all references that have corresponding wikilinks.
        // If the markdown parser sees a reference, it will format it before
        // we get a chance to create the wikilink.
        if (foamLinks.includes(refKey.toLowerCase())) {
          delete state.env.references[refKey];
        }
      });
    }
    return false;
  });
  return md;
};

export default markdownItRemoveLinkReferences;
