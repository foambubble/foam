import * as fs from 'fs';

export const writeFileToDisk = async (fileUri: string, data: string): Boolean => {
  return fs.promises.writeFile(fileUri, data).then(() => true).catch(err => {
    return false;
  })
}