import * as fs from 'fs';

export const writeFileToDisk = async (fileUri: string, data: string): Promise<Boolean> => {
  return fs.promises.writeFile(fileUri, data).then(() => true).catch(err => {
    console.log('error while writing to file: ', err)
    return false;
  })
}