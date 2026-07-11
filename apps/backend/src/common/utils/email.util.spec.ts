import { plainToInstance } from 'class-transformer';
import { normalizeEmail, NormalizeEmail } from './email.util';

describe('normalizeEmail', () => {
  it('lowercases a mixed-case email', () => {
    expect(normalizeEmail('Manthan.Jhaveri@CrawfordBayley.com')).toBe('manthan.jhaveri@crawfordbayley.com');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeEmail('  someone@example.com  ')).toBe('someone@example.com');
  });

  it('trims and lowercases together', () => {
    expect(normalizeEmail('  Someone@Example.COM  ')).toBe('someone@example.com');
  });

  it('leaves an already-normalized email unchanged', () => {
    expect(normalizeEmail('already@lowercase.com')).toBe('already@lowercase.com');
  });
});

describe('NormalizeEmail decorator', () => {
  class TestDto {
    @NormalizeEmail()
    email!: string;
  }

  it('normalizes the field when a DTO is built from a plain object', () => {
    const instance = plainToInstance(TestDto, { email: '  Mixed.Case@Example.COM  ' });
    expect(instance.email).toBe('mixed.case@example.com');
  });

  it('leaves non-string values untouched', () => {
    const instance = plainToInstance(TestDto, { email: undefined });
    expect(instance.email).toBeUndefined();
  });
});
