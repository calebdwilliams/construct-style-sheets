/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call */

const assignPattern = /Object\.assign/gmu;
const createPattern = /Object\.create/gmu;
const definePropertyPattern = /Object\.defineProperty/gmu;
const hasOwnPropertyPattern = /Object\.prototype\.hasOwnProperty/gmu;
const isPrototypeOfPattern = /Object\.prototype\.isPrototypeOf/gmu;
const setPrototypeOfPattern = /Object\.setPrototypeOf/gmu;
const injection = `
if (typeof document === 'undefined' || 'adoptedStyleSheets' in document) { return; }

const {
  assign,
  create: createObject,
  defineProperty,
  prototype: {hasOwnProperty, isPrototypeOf},
  setPrototypeOf,
} = Object;
`;

export default function rollupPluginOptimize() {
  return {
    name: 'optimize',
    async renderChunk(code) {
      const lines = code.split('\n');
      lines.splice(3, 0, injection);
      return lines
        .join('\n')
        .replaceAll(assignPattern, 'assign')
        .replaceAll(createPattern, 'createObject')
        .replaceAll(definePropertyPattern, 'defineProperty')
        .replaceAll(hasOwnPropertyPattern, 'hasOwnProperty')
        .replaceAll(isPrototypeOfPattern, 'isPrototypeOf')
        .replaceAll(setPrototypeOfPattern, 'setPrototypeOf');
    },
  };
}
