import { TrainNote } from '../../model/train-note';
import { IWriter } from './iwriter';

export class TrainNoteWriter implements IWriter {
  writer: IWriter;
  object: any;

  constructor(writer: IWriter, trainNote: TrainNote) {
    this.writer = writer;
    this.object = trainNote;
  }

  write(): Promise<boolean> {
    return this.writer.write();
  }
}
