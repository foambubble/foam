import { TrainNote } from '../../model/train-note';
import { IWriter } from './iwriter';

export class TrainNoteWriter implements IWriter {
  writer: IWriter;

  constructor(writer: IWriter) {
    this.writer = writer;
  }

  write(trainNote: TrainNote): Promise<void> {
    const model = {
      uri: trainNote.uri,
      currentPhase: trainNote.currentPhase,
      nextReminder: trainNote.nextReminder.toDateString(),
    };
    return this.writer.write(model);
  }
}
