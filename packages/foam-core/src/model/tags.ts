import { FoamWorkspace } from './workspace';
import { URI } from './uri';
import { IDisposable } from '../index';
import { Resource } from './note';

export type TagMetadata = { uri: URI };

export class FoamTags implements IDisposable {
  public readonly tags: { [key: string]: TagMetadata[] } = {};

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
      tags.resolveResource(resource)
    );

    if (keepMonitoring) {
      tags.disposables.push(
        workspace.onDidAdd(resource => {
          tags.resolveResource(resource);
        }),
        workspace.onDidUpdate(change => {
          tags.updateTagsForUpdatedResource(change.old, change.new);
        }),
        workspace.onDidDelete(resource => {
          tags.updateTagsForRemovedResource(resource);
        })
      );
    }
    return tags;
  }

  updateTagsForUpdatedResource(oldVersion: Resource, newVersion: Resource) {
    if (oldVersion.tags.size === 0 && newVersion.tags.size === 0) {
      return;
    }

    this.resolveUpdatedTags(newVersion, oldVersion);
    this.resolveMovedResource(newVersion, oldVersion);
  }

  updateTagsForRemovedResource(resource: Resource): void {
    if (resource.tags.size === 0) {
      return;
    }

    resource.tags.forEach(tag => {
      this.tags[tag] = this.tags[tag].filter(
        t => !URI.isEqual(t.uri, resource.uri)
      );

      if (this.tags[tag].length === 0) {
        delete this.tags[tag];
      }
    });
  }

  resolveResource(resource: Resource): void {
    resource.tags.forEach(tag => {
      this.tags[tag] = this.tags[tag] ?? [];
      this.tags[tag].push({ uri: resource.uri });
    });
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  /**
   * If the file has been moved, update all relevant metadata objects of the tag
   * @param newVersion
   * @param oldVersion
   */
  private resolveMovedResource(newVersion: Resource, oldVersion: Resource) {
    if (!URI.isEqual(oldVersion.uri, newVersion.uri)) {
      newVersion.tags.forEach(tag => {
        this.tags[tag].forEach((meta, idx) => {
          if (meta.uri === oldVersion.uri) {
            this.tags[tag][idx].uri = newVersion.uri;
          }
        });
      });
    }
  }

  /**
   * Look for differences in the tags of the resources and update accordingly
   *
   * @param newVersion
   * @param oldVersion
   */
  private resolveUpdatedTags(newVersion: Resource, oldVersion: Resource) {
    const newTags = Array.from(newVersion.tags).filter(
      t => !oldVersion.tags.has(t)
    );
    const removedTags = Array.from(oldVersion.tags).filter(
      t => !newVersion.tags.has(t)
    );

    newTags.forEach(newTag => {
      if (!this.tags[newTag]) {
        this.tags[newTag] = [];
      }

      this.tags[newTag].push({ uri: newVersion.uri });
    });

    removedTags.forEach(removedTag => {
      // should not happen
      if (!this.tags[removedTag]) {
        return;
      }

      this.tags[removedTag] = this.tags[removedTag].filter(
        meta => !URI.isEqual(meta.uri, newVersion.uri)
      );

      if (this.tags[removedTag].length === 0) {
        delete this.tags[removedTag];
      }
    });

    // No change in tags detected, but might be a newly added tag to the file
    if (
      removedTags.length === 0 &&
      newTags.length === 0 &&
      URI.isEqual(oldVersion.uri, newVersion.uri)
    ) {
      newVersion.tags.forEach(tag => {
        const noteRegistered = this.tags[tag].find(meta =>
          URI.isEqual(meta.uri, newVersion.uri)
        );

        if (!noteRegistered) {
          this.tags[tag].push({ uri: newVersion.uri });
        }
      });
    }
  }
}
