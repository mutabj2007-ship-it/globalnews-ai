/*
 * Runner for the QQ-9 qualification probe. Resolves `@globalnews-ai/shared` to THIS
 * checkout's shared/dist (a stale package link must never stand in for it) and runs the
 * TypeScript probe through ts-node, transpile-only. Run from backend/.
 */
const path = require('path');
const Module = require('module');

const SHARED = path.resolve(__dirname, '..', '..', '..', 'shared', 'dist', 'index.js');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === '@globalnews-ai/shared') return SHARED;
  return resolve.call(this, request, ...rest);
};

process.env.TS_NODE_PROJECT = path.resolve(__dirname, '..', '..', 'tsconfig.json');
require(require.resolve('ts-node', { paths: [path.resolve(__dirname, '..', '..')] })).register({
  transpileOnly: true,
});
require('./wikipedia-qualification.probe.ts');
