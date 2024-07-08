require('mocha/mocha');

console.log('Setting up Mocharrrr');
export function run(): Promise<void> {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise((resolve, reject) => {
    console.log('Setting up Mocha');
    mocha.setup({
      ui: 'tdd',
      reporter: undefined,
    });

    const importAll = (r: __WebpackModuleApi.RequireContext) =>
      r.keys().forEach(r);
    importAll(require.context('./../web', true, /\.spec$/));

    try {
      // Run the mocha test
      console.log('Run the tests');

      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }

    resolve();
  });
}
