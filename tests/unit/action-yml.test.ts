import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { load } from 'js-yaml';

const root = resolve(__dirname, '../..');

function loadActionYml(path: string): any {
  return load(readFileSync(path, 'utf8'));
}

describe('root action.yml', () => {
  const rootAction = loadActionYml(resolve(root, 'action.yml'));
  const pkgAction = loadActionYml(resolve(root, 'packages/action/action.yml'));

  it('points main to packages/action/dist/index.js', () => {
    expect(rootAction.runs.main).toBe('packages/action/dist/index.js');
  });

  it('uses node20 runtime', () => {
    expect(rootAction.runs.using).toBe('node20');
  });

  it('has the same inputs as packages/action/action.yml', () => {
    expect(Object.keys(rootAction.inputs ?? {})).toEqual(
      Object.keys(pkgAction.inputs ?? {})
    );
  });

  it('has the same outputs as packages/action/action.yml', () => {
    expect(Object.keys(rootAction.outputs ?? {})).toEqual(
      Object.keys(pkgAction.outputs ?? {})
    );
  });

  it('packages/action/action.yml still uses relative dist path', () => {
    expect(pkgAction.runs.main).toBe('dist/index.js');
  });
});
