import { describe, it, expect } from 'vitest';
import { parseGlimpseCommand } from '../../packages/core/src/trigger/command-parser.js';

describe('parseGlimpseCommand', () => {
  it('returns basic command with no flags', () => {
    expect(parseGlimpseCommand('/glimpse')).toEqual({ force: false, route: undefined });
  });

  it('parses --force flag', () => {
    expect(parseGlimpseCommand('/glimpse --force')).toEqual({ force: true, route: undefined });
  });

  it('parses --route flag', () => {
    expect(parseGlimpseCommand('/glimpse --route /products')).toEqual({
      force: false,
      route: '/products',
    });
  });

  it('parses both --force and --route', () => {
    expect(parseGlimpseCommand('/glimpse --force --route /checkout')).toEqual({
      force: true,
      route: '/checkout',
    });
  });

  it('finds command in multi-line comment', () => {
    const body = `Great work on this PR!\n\n/glimpse --force\n\nLooks good overall.`;
    expect(parseGlimpseCommand(body)).toEqual({ force: true, route: undefined });
  });

  it('returns null when no command present', () => {
    expect(parseGlimpseCommand('Just a regular comment.')).toBeNull();
  });

  it('does not match /glimpse mid-sentence', () => {
    expect(parseGlimpseCommand('Please run /glimpse for me')).toBeNull();
  });

  it('is case-insensitive for the command prefix', () => {
    expect(parseGlimpseCommand('/GLIMPSE')).toEqual({ force: false, route: undefined });
  });

  it('uses custom command prefix', () => {
    expect(parseGlimpseCommand('/demo --force', '/demo')).toEqual({
      force: true,
      route: undefined,
    });
  });

  it('does not match if prefix is immediately followed by non-space chars', () => {
    expect(parseGlimpseCommand('/glimpse-more')).toBeNull();
  });
});
