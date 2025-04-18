import { IWriter } from '../core/services/Writer/iwriter';
import { stringify as stringifyYaml } from 'yaml';
import { TrainNote } from '../core/model/train-note';

export class FrontmatterWriter implements IWriter {
  async write(note: TrainNote): Promise<void> {
    try {
      var yaml = this.Transform(note);
      await this.WriteFrontmatter(yaml);
    } catch (error) {
      throw new Error('Could not replace Frontmatter: \n' + error);
    }
  }

  private Transform(note: TrainNote) {
    const currentPhase = stringifyYaml(note.currentPhase);
    const nextReminder = stringifyYaml(note.nextReminder);
    var result = currentPhase + nextReminder;
    if (note.properties != null) {
      result += stringifyYaml(note.properties);
    }

    return result;
  }

  private WriteFrontmatter(yaml: string) {
    //unifiedjs anwenden
    //remarkfrontmatter
    //remark stringify
  }
}
