// @note: This will fail due to utils importing 'vscode'
// which needs to be mocked in the jest test environment.
// See: https://github.com/microsoft/vscode-test/issues/37
import { dropExtension } from '../src/utils';

describe("dropExtension", () => {
  test("returns file name without extension", () => {
    expect(dropExtension('file.md')).toEqual('file');
  });
});
