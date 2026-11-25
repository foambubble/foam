import { expect, test } from 'vitest';
import { openVSCode } from '../../../test/ui/vscode-window';

const NOTES = {
  'garden.md': '# Garden\n\nSee [[watering]] for the schedule.\n',
  'watering.md':
    '# Watering\n\nWater in the morning, at the base of the plant.\n',
  'mulching.md': '# Mulching\n\nIt halves the watering.\n',
  'jobs.md': '',
};

const DRAWN = { timeout: 15_000 };

test('typing [[ offers the workspace notes, and accepting one writes the link', async () => {
  const vscode = await openVSCode({ files: NOTES });
  await vscode.openFile('jobs.md');
  await vscode.page.keyboard.type('Also [[');

  const suggest = vscode.page.getByRole('listbox', { name: 'Suggest' });
  const offered = () =>
    suggest
      .getByRole('option')
      .evaluateAll(options => options.map(o => o.getAttribute('aria-label')));
  await expect
    .poll(offered, { ...DRAWN, message: 'the notes are offered' })
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^mulching/),
        expect.stringMatching(/^watering/),
      ])
    );

  await vscode.page.keyboard.type('mul');
  await suggest.getByRole('option', { name: /^mulching/ }).waitFor();
  await vscode.page.keyboard.press('Enter');

  await expect
    .poll(() => vscode.editorLines(), DRAWN)
    .toContain('Also [[mulching]]');
});

test('hovering a wikilink shows the note it links to', async () => {
  const vscode = await openVSCode({ files: NOTES });
  await vscode.openFile('garden.md');

  await vscode.hoverText('watering');

  await expect
    .poll(() => vscode.page.getByRole('tooltip').innerText(), {
      ...DRAWN,
      message: 'the hover shows the linked note',
    })
    .toContain('Water in the morning, at the base of the plant.');
});
