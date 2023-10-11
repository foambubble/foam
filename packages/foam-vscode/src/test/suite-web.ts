// eslint-disable-next-line import/no-extraneous-dependencies
import { cleanWorkspace } from './test-utils-vscode';
import * as path from 'path';
// import rf from 'rimraf';
require('mocha/mocha');

globalThis.beforeAll = globalThis.before;

export function run(): Promise<void> {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise((resolve, reject) => {
    // await cleanWorkspace();
    const testWorkspace = path.join(__dirname, '..', '..', '.test-workspace');

    // clean test workspace
    // rf.sync(path.join(testWorkspace, '*'));
    // rf.sync(path.join(testWorkspace, '.vscode'));
    // rf.sync(path.join(testWorkspace, '.foam'));
    try {
      console.log('Setting up Mocha');
      mocha.setup({
        ui: 'bdd',
        reporter: undefined,
      });

      const importAll = (r: __WebpackModuleApi.RequireContext) =>
        r.keys().forEach(r);
      importAll(require.context('./..', true, /tag-completion\.spec$/));

      try {
        // Run the mocha test
        console.log('Run the tests');
        mocha.run(failures => (process.exitCode = failures ? 1 : 0));
        // mocha.run(failures => {
        //   if (failures > 0) {
        //     reject(new Error(`${failures} tests failed.`));
        //   } else {
        //     resolve();
        //   }
        // });
      } catch (err) {
        console.error(err);
        reject(err);
      }

      resolve();
    } catch (error) {
      console.log('There was an error while running the Foam suite', error);
      return reject(error);
    } finally {
      // await cleanWorkspace();
    }
  });
}
