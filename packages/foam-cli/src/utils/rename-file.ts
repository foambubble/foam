import * as fs from 'fs';
import * as path from 'path';

/**
 *
 * @param fileUri absolute path for the file that needs to renamed
 * @param newFileName  "new file name" without the extension
 */
export const renameFile = async (fileUri: string, newFileName: string) => {
  const dirName = path.dirname(fileUri);
  const extension = path.extname(fileUri);
  const newFileUri = path.join(dirName, `${newFileName}${extension}`);

  return fs.promises.rename(fileUri, newFileUri);
};
