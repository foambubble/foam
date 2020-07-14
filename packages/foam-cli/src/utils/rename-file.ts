import * as fs from 'fs'



export const renameFile = async (fileUri: string, newFileName: string) => {
  const fileName = fileUri.split('/').pop();
  const extension = fileName?.split('.').pop();
  const newFileUri = fileUri.replace(`${fileName}`, `${newFileName}.${extension}`);

  return fs.promises.rename(fileUri, newFileUri);
}