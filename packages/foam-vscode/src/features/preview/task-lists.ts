/*global markdownit:readonly*/

import markdownItTaskLists from 'markdown-it-task-lists';
import { Foam } from '../../core/model/foam';
import { FoamWorkspace } from '../../core/model/workspace';
import { ResourceParser } from '../../core/model/note';

/**
 * Adds support for rendering GitHub-style task lists as checkboxes in the preview
 *
 * Example:
 * - [ ] Unchecked task
 * - [x] Checked task
 */
export const markdownItTaskListsPlugin = (
  md: markdownit,
  _workspace?: FoamWorkspace,
  _parser?: ResourceParser
) => {
  return md.use(markdownItTaskLists, {
    enabled: false, // checkboxes are disabled (non-interactive)
    label: true, // wrap checkbox + text in <label>
    labelAfter: true, // put text after checkbox
  });
};

export default markdownItTaskListsPlugin;
