import * as fs from 'fs';
import { URI } from 'foam-core';

export const writeFileToDisk = async (fileUri: URI, data: string) => {
  return fs.promises.writeFile(fileUri.fsPath, data);
};
