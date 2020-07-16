import * as fs from 'fs'

/**
 * 
 * @param fileUri absolute path for the file that needs to renamed
 * @param newFileName  "new file name" without the extension
 */
export const renameFile = async (fileUri: string, newFileName: string) => {
  const fileName = fileUri.split('/').pop();
  const extension = fileName?.split('.').pop();
  const newFileUri = fileUri.replace(`${fileName}`, `${newFileName}.${extension}`);

  return fs.promises.rename(fileUri, newFileUri);
}