import { IWriter } from '../services/Writer/iwriter';

export interface Observer {
  update: () => void;
}

export class WriteObserver implements Observer {
  writer: IWriter;

  constructor(writer: IWriter) {
    this.writer = writer;
  }

  update(): void {
    this.writer.write();
  }
}

export class Subject {
  private observer: Observer;

  Attach(observer: Observer): void {
    this.observer = observer;
  }

  Detach() {
    this.observer = null;
  }

  Notify() {
    this.observer.update();
  }
}
