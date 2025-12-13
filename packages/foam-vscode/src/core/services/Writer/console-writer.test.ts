import { ConsoleWriter } from './console-writer';

describe('console-writer', () => {
  it('write', () => {
    var person = { Name: 'Ella', Nachname: 'Müller', Alter: 13 };
    const logSpy = jest.spyOn(global.console, 'log');

    var writer = new ConsoleWriter();
    writer.write(person);

    expect(logSpy).toHaveBeenCalledWith(
      `Name: ${person.Name}, \n` +
        `Nachname: ${person.Nachname}, \n` +
        `Alter: ${person.Alter}`
    );
    logSpy.mockRestore();
  });
});
