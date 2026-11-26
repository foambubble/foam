import { expect, test } from 'vitest';
import { openVSCode } from '../../../test/ui/vscode-window';

const NOTES = {
  'alpha.md': '# Alpha\n\nLinks to [[beta]].\n',
  'beta.md': '# Beta\n\nLinks back to [[alpha]].\n',
};

// The webview saves its view state 250 ms after the last change
// (VIEW_STATE_DEBOUNCE_MS in @foam/graph-view's host bridge), and shows
// nothing when it does.
const VIEW_STATE_SAVED_MS = 1000;

const DRAWN = { timeout: 15_000 };

// specs/1787-graph-hide-controls AC-7
test('the controls panel is still hidden after the window is reloaded', async () => {
  const vscode = await openVSCode({ files: NOTES });
  await vscode.runCommand('Foam: Show Graph');
  let graph = await vscode.webview('foam-graph');
  await graph.getByRole('button', { name: 'Hide the controls panel' }).click();
  await expect
    .poll(
      () =>
        graph
          .getByRole('button', { name: 'Show the controls panel' })
          .isVisible(),
      { ...DRAWN, message: 'the panel hides when asked to' }
    )
    .toBe(true);
  await new Promise(resolve => setTimeout(resolve, VIEW_STATE_SAVED_MS));

  await vscode.reload();
  await expect
    .poll(
      () => vscode.page.getByRole('treeitem', { name: 'alpha.md' }).isVisible(),
      { ...DRAWN, message: 'the reloaded window has the same workspace' }
    )
    .toBe(true);
  await vscode.runCommand('Foam: Show Graph');

  graph = await vscode.webview('foam-graph');
  await expect
    .poll(
      () =>
        graph
          .getByRole('button', { name: 'Show the controls panel' })
          .isVisible(),
      { ...DRAWN, message: 'the reopened graph offers to show the panel' }
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        graph
          .getByRole('button', { name: 'Hide the controls panel' })
          .isVisible(),
      { ...DRAWN, message: 'the panel is not drawn' }
    )
    .toBe(false);
});

test('the show control takes its colours from the colour theme', async () => {
  const vscode = await openVSCode({ files: NOTES });
  await vscode.runCommand('Foam: Show Graph');
  const graph = await vscode.webview('foam-graph');
  await graph.getByRole('button', { name: 'Hide the controls panel' }).click();
  const show = graph.getByRole('button', { name: 'Show the controls panel' });
  await show.waitFor();

  // the control's background, and the theme's side-bar background, as drawn
  const colours = () =>
    show.evaluate(control => {
      const sample = document.createElement('div');
      sample.style.background = 'var(--vscode-sideBar-background)';
      document.body.append(sample);
      const sideBar = getComputedStyle(sample).backgroundColor;
      sample.remove();
      return { control: getComputedStyle(control).backgroundColor, sideBar };
    });
  const isLight = () =>
    graph.evaluate(() => document.body.classList.contains('vscode-light'));

  const dark = await colours();
  expect(dark.control).toBe(dark.sideBar);
  await vscode.screenshot('dark theme');

  await vscode.updateSettings({
    'workbench.colorTheme': 'Default Light Modern',
  });
  await expect
    .poll(isLight, { ...DRAWN, message: 'the graph is in the light theme' })
    .toBe(true);
  const light = await colours();
  expect(light.control).toBe(light.sideBar);
  expect(light.control).not.toBe(dark.control);
  await vscode.screenshot('light theme');
});
