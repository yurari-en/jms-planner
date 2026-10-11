import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('smoke', () => {
  it('public/data/starforce.json が読めて maxStarByLevel を持つ', () => {
    const file = path.resolve(here, '../../public/data/starforce.json');
    const json: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(json).toHaveProperty('maxStarByLevel');
  });
});
