import { FoamWorkspace } from './workspace';
import { URI } from './uri';
import { Resource } from './note';
import { IDisposable } from '../common/lifecycle';

export class FoamTags implements IDisposable {
  public readonly tags: Map<string, URI[]> = new Map();

  /**
   * List of disposables to destroy with the tags
   */
  private disposables: IDisposable[] = [];

  /**
   * Computes all tags in the workspace and keep them up-to-date
   *
   * @param workspace the target workspace
   * @param keepMonitoring whether to recompute the links when the workspace changes
   * @returns the FoamTags
   */
  public static fromWorkspace(
    workspace: FoamWorkspace,
    keepMonitoring = false
  ): FoamTags {
    const tags = new FoamTags();

    workspace
      .list()
      .forEach(resource => tags.addResourceFromTagIndex(resource));

    if (keepMonitoring) {
      tags.disposables.push(
        workspace.onDidAdd(resource => {
          tags.addResourceFromTagIndex(resource);
        }),
        workspace.onDidUpdate(change => {
          tags.updateResourceWithinTagIndex(change.old, change.new);
        }),
        workspace.onDidDelete(resource => {
          tags.removeResourceFromTagIndex(resource);
        })
      );
    }
    return tags;
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  updateResourceWithinTagIndex(oldResource: Resource, newResource: Resource) {
    this.removeResourceFromTagIndex(oldResource);
    this.addResourceFromTagIndex(newResource);
  }

  addResourceFromTagIndex(resource: Resource) {
    new Set(resource.tags.map(t => t.label)).forEach(tag => {
      const tagMeta = this.tags.get(tag) ?? [];
      tagMeta.push(resource.uri);
      this.tags.set(tag, tagMeta);
    });
  }

  removeResourceFromTagIndex(resource: Resource) {
    resource.tags.forEach(t => {
      const tag = t.label;
      if (this.tags.has(tag)) {
        const remainingLocations = this.tags
          .get(tag)
          ?.filter(uri => !uri.isEqual(resource.uri));

        if (remainingLocations && remainingLocations.length > 0) {
          this.tags.set(tag, remainingLocations);
        } else {
          this.tags.delete(tag);
        }
      }
    });
  }
}
