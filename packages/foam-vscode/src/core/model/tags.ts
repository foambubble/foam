import { FoamWorkspace } from './workspace/foamWorkspace';
import { IDisposable } from '../common/lifecycle';
import { debounce } from 'lodash';
import { Emitter } from '../common/event';
import { Tag } from './note';
import { Location } from './location';

export class FoamTags implements IDisposable {
  public readonly tags: Map<string, Location<Tag>[]> = new Map();

  private onDidUpdateEmitter = new Emitter<void>();
  onDidUpdate = this.onDidUpdateEmitter.event;

  /**
   * List of disposables to destroy with the tags
   */
  private disposables: IDisposable[] = [];

  constructor(private readonly workspace: FoamWorkspace) {}

  /**
   * Computes all tags in the workspace and keep them up-to-date
   *
   * @param workspace the target workspace
   * @param keepMonitoring whether to recompute the links when the workspace changes
   * @param debounceFor how long to wait between change detection and tags update
   * @returns the FoamTags
   */
  public static fromWorkspace(
    workspace: FoamWorkspace,
    keepMonitoring = false,
    debounceFor = 0
  ): FoamTags {
    const tags = new FoamTags(workspace);
    tags.update();

    if (keepMonitoring) {
      const updateTags =
        debounceFor > 0
          ? debounce(tags.update.bind(tags), 500)
          : tags.update.bind(tags);
      tags.disposables.push(
        workspace.onDidAdd(updateTags),
        workspace.onDidUpdate(updateTags),
        workspace.onDidDelete(updateTags)
      );
    }
    return tags;
  }

  update(): void {
    this.tags.clear();
    for (const resource of this.workspace.resources()) {
      for (const tag of resource.tags) {
        const tagLocations = this.tags.get(tag.label) ?? [];
        tagLocations.push(Location.forObjectWithRange(resource.uri, tag));
        this.tags.set(tag.label, tagLocations);
      }
    }
    this.onDidUpdateEmitter.fire();
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
