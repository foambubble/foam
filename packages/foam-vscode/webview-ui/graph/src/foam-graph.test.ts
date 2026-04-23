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
});
