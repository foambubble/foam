import markdownit from 'markdown-it';
import markdownItTaskListsPlugin from './task-lists';

describe('task-lists plugin', () => {
  const md = markdownit().use(markdownItTaskListsPlugin);

  it('renders unchecked checkbox', () => {
    const input = '- [ ] Buy milk';
    const output = md.render(input);

    expect(output).toContain('class="task-list-item-checkbox"');
    expect(output).toContain('type="checkbox"');
    expect(output).toContain('Buy milk');
    expect(output).not.toContain('checked=');
  });

  it('renders checked checkbox', () => {
    const input = '- [x] Done task';
    const output = md.render(input);

    expect(output).toContain('class="task-list-item-checkbox"');
    expect(output).toContain('type="checkbox"');
    expect(output).toContain('Done task');
    expect(output).toContain('checked=');
  });

  it('renders uppercase X checkbox as checked', () => {
    const input = '- [X] Done task with uppercase';
    const output = md.render(input);

    expect(output).toContain('class="task-list-item-checkbox"');
    expect(output).toContain('type="checkbox"');
    expect(output).toContain('Done task with uppercase');
    expect(output).toContain('checked=');
  });

  it('renders checkboxes inside nested lists', () => {
    const input = '- Parent item\n  - [ ] Nested task';
    const output = md.render(input);

    expect(output).toContain('class="task-list-item-checkbox"');
    expect(output).toContain('type="checkbox"');
    expect(output).toContain('Nested task');
  });

  it('does not render checkbox when there is no space after brackets', () => {
    const input = '- []No space';
    const output = md.render(input);

    expect(output).not.toContain('class="task-list-item-checkbox"');
    expect(output).not.toContain('type="checkbox"');
  });

  it('does not render checkbox in regular text with brackets', () => {
    const input = 'This is a [ ] normal text';
    const output = md.render(input);

    expect(output).not.toContain('class="task-list-item-checkbox"');
    expect(output).not.toContain('type="checkbox"');
  });
});
