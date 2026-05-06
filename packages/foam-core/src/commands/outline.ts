import { Resource } from '../model/note';
import { FoamWorkspace } from '../model/workspace';
import { URI } from '../model/uri';

export interface OutlineSection {
  label: string;
  level: number;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface OutlineResult {
  id: string;
  uri: URI;
  sections: OutlineSection[];
}

/**
 * Returns the heading structure (sections) of a resource.
 */
export function outlineData(
  workspace: FoamWorkspace,
  resource: Resource
): OutlineResult {
  const id = workspace.getIdentifier(resource.uri);

  return {
    id,
    uri: resource.uri,
    sections: resource.sections.map(s => ({
      label: s.label,
      level: s.level,
      range: {
        start: { line: s.range.start.line, character: s.range.start.character },
        end: { line: s.range.end.line, character: s.range.end.character },
      },
    })),
  };
}
