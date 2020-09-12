// this file can't simply be .d.ts because the TS compiler wouldn't copy it to the dist directory
// see https://stackoverflow.com/questions/56018167/typescript-does-not-copy-d-ts-files-to-build
export { Position, Point } from 'unist';

export type URI = string;
export type ID = string;
