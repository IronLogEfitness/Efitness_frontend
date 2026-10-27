// expo-secure-store is imported at module load by updateCheck; mock it so the
// pure version-comparison logic can be tested in Node without the native module.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));

import { isNewerVersion } from '../updateCheck';

describe('isNewerVersion', () => {
  it('is true when the candidate is strictly newer', () => {
    expect(isNewerVersion('1.0.2', '1.0.1')).toBe(true);
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(true);
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
  });

  it('compares segments numerically, not lexically', () => {
    expect(isNewerVersion('1.0.10', '1.0.9')).toBe(true);
    expect(isNewerVersion('1.0.9', '1.0.10')).toBe(false);
  });

  it('treats missing trailing segments as zero', () => {
    expect(isNewerVersion('1.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.0', '1.0')).toBe(false);
    expect(isNewerVersion('1.0.1', '1.0')).toBe(true);
  });

  it('ignores a leading "v"', () => {
    expect(isNewerVersion('v1.2.0', '1.1.0')).toBe(true);
    expect(isNewerVersion('v1.0.0', 'v1.0.0')).toBe(false);
  });

  it('is false for equal or older candidates (no downgrade / re-tag prompt)', () => {
    expect(isNewerVersion('1.0.1', '1.0.1')).toBe(false);
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
  });

  it('treats non-numeric segments as zero', () => {
    expect(isNewerVersion('1.0.x', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.1', '1.0.x')).toBe(true);
  });
});
