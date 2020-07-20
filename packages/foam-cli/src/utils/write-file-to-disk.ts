import * as fs from 'fs';

export const writeFileToDisk = async (fileUri: string, data: string) => {
  return fs.promises.writeFile(fileUri, data);
};
