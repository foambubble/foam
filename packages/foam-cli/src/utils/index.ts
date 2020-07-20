import * as fs from 'fs';

export const isValidDirectory = (path: string) =>
  fs.existsSync(path) && fs.lstatSync(path).isDirectory();
