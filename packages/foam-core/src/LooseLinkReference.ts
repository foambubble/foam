import { ID } from './note-graph';

export interface ILooseLinkReference {
    /**
     * Base name of the file without extension, e.g. `Zoë File`
     */
    original: ID;
    /**
     * Cleaned version of the file, removing accents, casing, slugs, e.g. `zoe-file`
     */
    clean: string;
}

export interface IMatchResult extends ILooseLinkReference {
    title: string;
}

export class LooseLinkReference implements ILooseLinkReference {
  original: ID;
  clean: string;
  constructor(original: string) {
    this.original = original;
    this.clean = LooseLinkReference.cleanPath(original);
  }
  public static cleanPath(path: string): string {
    const slug = '-'; //perhaps a config would be a better choice;
    return path
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") //Remove accents
      .replace(/[!"\#$%&'()*+,\-./:;<=>?@\[\\\]^_‘{|}~\s]+/gi, slug) //Normalise slugs
      .toLowerCase() // lower
      .replace(/[-_－＿ ]*$/g, ''); // removing trailing slug chars
  }
  public static findBestMatchIndex(arrFiles: Array<ILooseLinkReference>, file: ILooseLinkReference): number {
    let index = arrFiles.findIndex(v => v.original === file.original);
    if (index === -1) {
      index = arrFiles.findIndex(v => v.clean === file.clean);
    }
    return index;
  }
  public static findBestMatch(arrFiles: Array<ILooseLinkReference>, file: ILooseLinkReference): ILooseLinkReference {
    return arrFiles[LooseLinkReference.findBestMatchIndex(arrFiles, file)];
  }
}
