import { env } from 'vscode';
/*
Note: this is needed in order to test certain parts
of functionality of `foam-vscode`

Following the advice from this article:
https://www.richardkotze.com/coding/unit-test-mock-vs-code-extension-api-jest

combined with advice from this GitHub issue comment:
https://github.com/microsoft/vscode-test/issues/37#issuecomment-584744386
*/

const vscode = {
    // Add values and methods as needed for tests

    // Keep env the same, no need to mock this.
    env: env
};

module.exports = vscode;