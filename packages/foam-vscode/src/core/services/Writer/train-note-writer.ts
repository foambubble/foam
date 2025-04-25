import { TrainNote } from '../../model/train-note';
import { IWriter } from './iwriter';

export class TrainNoteWriter implements IWriter {
  writer: IWriter;

  constructor(writer: IWriter) {
    this.writer = writer;
  }

  write(trainNote: TrainNote): Promise<void> {
    return this.writer.write(trainNote, trainNote.uri);
  }
}
