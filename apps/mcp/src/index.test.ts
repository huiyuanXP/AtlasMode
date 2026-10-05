import { describe, expect, it } from 'vitest';
import { apiAddress } from './index.js';
describe('MCP destination boundary', () => {
  it('accepts plain loopback origins', () => {
    expect(apiAddress('http://127.0.0.1:4310')).toBe('http://127.0.0.1:4310');
  });
  it.each([
    'https://example.com',
    'http://example.com',
    'http://127.0.0.1:4310/path',
    'http://user:password@127.0.0.1:4310',
    'http://127.0.0.1:4310?token=fake',
  ])('rejects remote or credential-bearing configuration %s', (value) => {
    expect(() => apiAddress(value)).toThrow('loopback');
  });
});
