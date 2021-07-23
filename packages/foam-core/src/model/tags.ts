import { FoamWorkspace } from './workspace';
import { URI } from './uri';
import { IDisposable } from '../index';
import { Resource } from './note';

export type TagMetadata = { uri: URI };

export class FoamTags implements IDisposable {
  public readonly tags: Map<string, TagMetadata[]> = new Map();

  constructor(private readonly workspace: FoamWorkspace) {}

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
    keepMonitoring: boolean = false
  ): FoamTags {
    let tags = new FoamTags(workspace);

    Object.values(workspace.list()).forEach(resource =>
      tags.addResourceFromTagIndex(resource)
    );

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
    resource.tags.forEach(tag => {
      this.tags.set(tag, this.tags.get(tag) ?? []);
      this.tags.get(tag)?.push({ uri: resource.uri });
    });
  }

  removeResourceFromTagIndex(resource: Resource) {
    resource.tags.forEach(tag => {
      if (this.tags.has(tag)) {
        const remainingLocations = this.tags
          .get(tag)
          ?.filter(meta => !URI.isEqual(meta.uri, resource.uri));

        if (remainingLocations && remainingLocations.length > 0) {
          this.tags.set(tag, remainingLocations);
        } else {
          this.tags.delete(tag);
        }
      }
    });
  }
}
