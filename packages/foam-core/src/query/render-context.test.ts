import { createRenderContext } from './render-context';
import { URI } from '../model/uri';

const a = URI.file('/a.md');
const b = URI.file('/b.md');

describe('RenderContext', () => {
  it('enter pushes a new uri and returns true', () => {
    const ctx = createRenderContext();
    expect(ctx.enter(a)).toBe(true);
    expect(ctx.has(a)).toBe(true);
  });

  it('enter returns false when the uri is already on the stack', () => {
    const ctx = createRenderContext();
    ctx.enter(a);
    expect(ctx.enter(a)).toBe(false);
  });

  it('compares URIs by value, not by identity', () => {
    // A fresh URI object pointing at the same resource should still be
    // detected as a cycle — otherwise embed/query coordination breaks the
    // moment the two plugins construct their own URI instances.
    const ctx = createRenderContext();
    ctx.enter(URI.file('/a.md'));
    expect(ctx.enter(URI.file('/a.md'))).toBe(false);
  });

  it('exit removes the uri so it can be entered again', () => {
    const ctx = createRenderContext();
    ctx.enter(a);
    ctx.exit(a);
    expect(ctx.has(a)).toBe(false);
    expect(ctx.enter(a)).toBe(true);
  });

  it('handles a sequence of nested enters and exits', () => {
    const ctx = createRenderContext();
    ctx.enter(a);
    ctx.enter(b);
    expect(ctx.current().map(u => u.path)).toEqual(['/a.md', '/b.md']);
    // While both are on the stack, neither can be entered again.
    expect(ctx.enter(a)).toBe(false);
    expect(ctx.enter(b)).toBe(false);
    ctx.exit(b);
    expect(ctx.current().map(u => u.path)).toEqual(['/a.md']);
    expect(ctx.enter(b)).toBe(true);
  });

  it('exit is a no-op for a uri that is not on the stack', () => {
    const ctx = createRenderContext();
    ctx.exit(URI.file('/never-entered.md'));
    expect(ctx.current()).toEqual([]);
  });
});
