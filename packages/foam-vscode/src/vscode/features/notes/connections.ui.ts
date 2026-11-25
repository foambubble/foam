import { expect, test } from 'vitest';
import { openVSCode } from '../../../test/ui/vscode-window';

const NOTES = {
  'watering.md': '# Watering\n\nWater in the morning.\n',
  'tomatoes.md': '# Tomatoes\n\nCurling leaves: check the [[watering]].\n',
  'courgettes.md': '# Courgettes\n\nNeeds deep [[watering]] once a week.\n',
  'garlic.md': '# Garlic\n\nPlant single cloves in autumn.\n',
};

const DRAWN = { timeout: 15_000 };

test('the Connections view lists the notes linking to the open note, and opens them', async () => {
  const vscode = await openVSCode({ files: NOTES });
  await vscode.openFile('watering.md');
  await vscode.page.getByRole('button', { name: /^Connections/ }).click();

  const connections = vscode.page.getByRole('tree', { name: 'Connections' });
  const rows = () =>
    connections
      .getByRole('treeitem')
      .evaluateAll(items => items.map(i => i.getAttribute('aria-label')));
  await expect
    .poll(rows, { ...DRAWN, message: 'the linking notes are listed' })
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Courgettes/),
        expect.stringMatching(/^Tomatoes/),
      ])
    );
  expect(await rows()).not.toContainEqual(expect.stringMatching(/^Garlic/));

  await connections
    .getByRole('treeitem', { name: /check the \[\[watering\]\]/ })
    .click();

  await expect
    .poll(
      () =>
        vscode.page
          .getByRole('main')
          .getByRole('tab', { name: /^tomatoes\.md/ })
          .getAttribute('aria-selected'),
      { ...DRAWN, message: 'the linking note is open in the editor' }
    )
    .toBe('true');
});
