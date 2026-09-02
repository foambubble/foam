import { AttachmentResourceProvider } from './attachment-provider';
import { URI } from '../model/uri';

describe('AttachmentResourceProvider', () => {
  it('classifies image extensions case-insensitively, consistently with supports()', async () => {
    const provider = new AttachmentResourceProvider();
    const uri = URI.file('/photo.PNG');

    expect(provider.supports(uri)).toBe(true);

    const resource = await provider.fetch(uri);
    expect(resource.type).toEqual('image');

    const markdown = await provider.readAsMarkdown(uri);
    expect(markdown).toContain('![');
  });

  it('classifies non-image attachments as attachment', async () => {
    const provider = new AttachmentResourceProvider();
    const uri = URI.file('/doc.pdf');

    const resource = await provider.fetch(uri);
    expect(resource.type).toEqual('attachment');
    expect(await provider.readAsMarkdown(uri)).toBe('### doc.pdf');
  });
});
