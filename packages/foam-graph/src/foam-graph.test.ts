import { describe, expect, it } from 'vitest';
import type { TemplateResult } from 'lit';

import { FoamGraph } from './foam-graph';
import { makeGraph } from './test-utils';

describe('foam-graph', () => {
  it('can show/hide the control panel', () => {
    const element = new FoamGraph();

    element.graphData = makeGraph({
      nodeInfo: {
        '/note': {
          id: '/note',
          type: 'note',
          title: 'Note',
          properties: {},
          tags: [],
        },
      },
    });
    element.showControls = true;

    const t1 = element.render() as TemplateResult;
    const c1 = t1.values.find(
      v =>
        v != null &&
        typeof v === 'object' &&
        'strings' in v &&
        (v as TemplateResult).strings.some(s =>
          s.includes('foam-control-panel')
        )
    );

    expect(c1).not.toBeUndefined();

    element.showControls = false;

    const t2 = element.render() as TemplateResult;
    const c2 = t2.values.find(
      v =>
        v != null &&
        typeof v === 'object' &&
        'strings' in v &&
        (v as TemplateResult).strings.some(s =>
          s.includes('foam-control-panel')
        )
    );

    expect(c2).toBeUndefined();
  });

  it('derives visible graph data from raw graph data', () => {
    const element = new FoamGraph();
    element.graphData = makeGraph({
      nodeInfo: {
        note: {
          id: 'note',
          type: 'note',
          title: 'Note',
          properties: {},
          tags: [{ label: 'topic' }],
        },
      },
    });

    (element as any).updated(new Map([['graphData', null]]));

    const visibleGraph = (element as any).visibleGraph;
    expect(visibleGraph.nodeInfo.note).toBeDefined();
    expect(visibleGraph.nodeInfo.topic.type).toBe('tag');
  });

  it('keeps derived graph data cached for unrelated visual state changes', () => {
    const element = new FoamGraph();
    element.graphData = makeGraph({
      nodeInfo: {
        note: {
          id: 'note',
          type: 'note',
          title: 'Note',
          properties: {},
          tags: [],
        },
      },
    });

    (element as any).updated(new Map([['graphData', null]]));
    const visibleGraph = (element as any).visibleGraph;
    const graphStates = (element as any).graphStates;

    element.labels = { fade: 1 };
    element.render();

    expect((element as any).visibleGraph).toBe(visibleGraph);
    expect((element as any).graphStates).toBe(graphStates);
  });

  it('recomputes graph states when hover changes', () => {
    const element = new FoamGraph();
    element.graphData = makeGraph({
      nodeInfo: {
        note: {
          id: 'note',
          type: 'note',
          title: 'Note',
          properties: {},
          tags: [],
        },
      },
    });

    (element as any).updated(new Map([['graphData', null]]));
    (element as any).hoverNodeId = 'note';
    (element as any).updated(new Map([['hoverNodeId', null]]));

    expect((element as any).graphStates.nodeStates.get('note')).toBe(
      'highlighted'
    );
  });

  it('accepts graph nodes without tags when deriving autocomplete options', () => {
    const element = new FoamGraph();
    element.graphData = makeGraph({
      nodeInfo: {
        attachment: {
          id: 'attachment',
          type: 'attachment',
          title: 'Attachment',
          properties: {},
        } as any,
      },
    });

    (element as any).updated(new Map([['graphData', null]]));

    expect(() => element.render()).not.toThrow();
  });

  it('updates app state from child intent events', () => {
    const element = new FoamGraph();

    (element as any)._onToggleNodeType({ type: 'tag', visible: false });
    expect((element as any).showNodesOfType.tag).toBe(false);

    (element as any)._onCanvasNodeClick({ nodeId: 'note-a', append: false });
    expect([...(element as any).selectedNodeIds]).toEqual(['note-a']);

    (element as any)._onCanvasNodeClick({ nodeId: 'note-b', append: true });
    expect([...(element as any).selectedNodeIds]).toEqual(['note-a', 'note-b']);

    (element as any)._onCanvasBackgroundClick({ append: false });
    expect((element as any).selectedNodeIds.size).toBe(0);
  });

  it('keeps public node-click event detail as the node id string', () => {
    const element = new FoamGraph();
    let detail: unknown;
    element.addEventListener('node-click', (event: Event) => {
      detail = (event as CustomEvent).detail;
    });

    (element as any)._onCanvasNodeClick({ nodeId: 'note-a', append: false });

    expect(detail).toBe('note-a');
  });

  it('replaces groups when a new graph style provides groups', () => {
    const element = new FoamGraph();
    (element as any).groups = [
      {
        id: 'local',
        label: 'Local',
        color: '#111111',
        enabled: true,
        match: { property: 'type', value: 'note' },
      },
    ];
    element.graphStyle = {
      groups: [
        {
          id: 'configured',
          label: 'Configured',
          color: '#222222',
          enabled: true,
          match: { property: 'tag', value: 'project' },
        },
      ],
    };

    (element as any).updated(new Map([['graphStyle', null]]));

    expect(
      (element as any).groups.map((group: { id: string }) => group.id)
    ).toEqual(['configured']);
  });

  it('passes labels setting to the canvas', () => {
    const element = new FoamGraph();
    element.showControls = false;
    element.labels = 'always';

    const t = element.render() as TemplateResult;

    expect(t.strings.join('')).toContain('.labels=');
    expect(t.values).toContain('always');
  });

  // AC-4: a changed truncation length reaches the canvas binding
  it('passes an applied titleMaxLength to the canvas', () => {
    const element = new FoamGraph();
    element.showControls = false;

    element.applyViewState({ titleMaxLength: 7 });

    const t = element.render() as TemplateResult;
    expect(t.strings.join('')).toContain('.titleMaxLength=');
    expect(t.values).toContain(7);
  });

  it('round-trips the view state through apply and get', () => {
    const element = new FoamGraph();

    element.applyViewState({
      titleMaxLength: 10,
      showNodesOfType: { placeholder: false, note: true },
      nodeSizeMultiplier: 3,
      animateLinks: 'off',
    });

    const state = element.getViewState();
    expect(state.titleMaxLength).toBe(10);
    expect(state.showNodesOfType?.placeholder).toBe(false);
    expect(state.nodeSizeMultiplier).toBe(3);
    expect(state.animateLinks).toBe('off');
  });

  // AC-9: restored filters survive graph data arrival (which derives
  // filters for types it discovers) instead of being reset
  it('keeps restored type filters when graph data arrives', () => {
    const element = new FoamGraph();

    element.applyViewState({
      showNodesOfType: { placeholder: false, 'daily-note': false },
    });

    element.graphData = makeGraph({
      nodeInfo: {
        note: {
          id: 'note',
          type: 'note',
          title: 'Note',
          properties: {},
          tags: [],
        },
        daily: {
          id: 'daily',
          type: 'daily-note',
          title: 'Daily',
          properties: {},
          tags: [],
        },
        project: {
          id: 'project',
          type: 'project',
          title: 'Project',
          properties: {},
          tags: [],
        },
      },
    });
    (element as any).updated(new Map([['graphData', null]]));

    const filters = element.getViewState().showNodesOfType!;
    expect(filters.placeholder).toBe(false);
    expect(filters['daily-note']).toBe(false);
    // a type the saved state does not know still gets its default
    expect(filters.project).toBe(true);
  });

  it('emits view-state-change when the user changes a display option', () => {
    const element = new FoamGraph();
    let emitted = false;
    element.addEventListener('view-state-change', () => {
      emitted = true;
    });

    (element as any)._onToggleNodeType({ type: 'tag', visible: false });

    expect(emitted).toBe(true);
    expect(element.getViewState().showNodesOfType!.tag).toBe(false);
  });

  // AC-4, control-panel path: the panel's change event updates the state
  // the canvas is bound to, and announces it for persistence
  it('updates the truncation length from the control panel', () => {
    const element = new FoamGraph();
    let emitted = false;
    element.addEventListener('view-state-change', () => {
      emitted = true;
    });

    (element as any)._onTitleMaxLengthChange(7);

    expect(element.getViewState().titleMaxLength).toBe(7);
    expect(emitted).toBe(true);
  });

  // replace semantics: restoring a view must not inherit another view's
  // interactive tweaks
  it('resets to defaults before applying a restored state', () => {
    const element = new FoamGraph();

    (element as any)._onToggleNodeType({ type: 'placeholder', visible: false });
    element.applyViewState({ titleMaxLength: 10 });

    const state = element.getViewState();
    expect(state.titleMaxLength).toBe(10);
    expect(state.showNodesOfType?.placeholder).toBe(true);
  });

  it('keeps the declared style layer when restoring a view state', () => {
    const element = new FoamGraph();
    element.graphStyle = { showNodesOfType: { tag: false } };

    element.applyViewState({});

    expect(element.getViewState().showNodesOfType?.tag).toBe(false);
  });
});
