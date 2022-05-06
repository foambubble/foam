import { FoamWorkspace } from './workspace';
import { URI } from './uri';
import { IDisposable } from '../common/lifecycle';
import { debounce } from 'lodash';
import { Emitter } from '../common/event';

export class FoamTags implements IDisposable {
  public readonly tags: Map<string, URI[]> = new Map();

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
      for (const tag of new Set(resource.tags.map(t => t.label))) {
        const tagMeta = this.tags.get(tag) ?? [];
        tagMeta.push(resource.uri);
        this.tags.set(tag, tagMeta);
      }
    }
    this.onDidUpdateEmitter.fire();
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
