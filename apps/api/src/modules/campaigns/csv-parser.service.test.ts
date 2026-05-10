import { describe, it, expect } from 'vitest';
import { parseCsvBuffer } from './csv-parser.service.js';

function csv(...rows: string[]): Buffer {
  return Buffer.from(rows.join('\n'), 'utf-8');
}

describe('parseCsvBuffer', () => {
  it('parses a minimal valid CSV', async () => {
    const buf = csv(
      'first_name,last_name,phone',
      'Alice,Smith,+12125551234',
      'Bob,Jones,+14155559876'
    );
    const { rows, errors } = await parseCsvBuffer(buf);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.phoneE164).toBe('+12125551234');
    expect(rows[0]!.firstName).toBe('Alice');
    expect(rows[0]!.lastName).toBe('Smith');
    expect(rows[1]!.firstName).toBe('Bob');
  });

  it('normalises US phones without country code', async () => {
    const buf = csv(
      'first_name,phone',
      'Alice,(212) 555-1234',
      'Bob,4155559876'
    );
    const { rows, errors } = await parseCsvBuffer(buf);
    expect(errors).toHaveLength(0);
    expect(rows[0]!.phoneE164).toBe('+12125551234');
    expect(rows[1]!.phoneE164).toBe('+14155559876');
  });

  it('rejects rows with invalid phone numbers', async () => {
    const buf = csv(
      'first_name,phone',
      'Alice,notaphone',
      'Bob,+14155559876'
    );
    const { rows, errors } = await parseCsvBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.firstName).toBe('Bob');
    expect(errors.some((e) => e.includes('Row 2'))).toBe(true);
    expect(errors.some((e) => e.includes('invalid phone'))).toBe(true);
  });

  it('skips rows with missing first name', async () => {
    const buf = csv(
      'first_name,phone',
      ',+12125551234',
      'Alice,+14155559876'
    );
    const { rows, errors } = await parseCsvBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(errors.some((e) => e.includes('first name'))).toBe(true);
  });

  it('accepts flexible column names', async () => {
    const buf = csv(
      'FirstName,Mobile,Email Address',
      'Carol,+12125551234,carol@test.com'
    );
    const { rows, errors } = await parseCsvBuffer(buf);
    expect(errors).toHaveLength(0);
    expect(rows[0]!.email).toBe('carol@test.com');
    expect(rows[0]!.firstName).toBe('Carol');
  });

  it('returns an error for missing phone column', async () => {
    const buf = csv('first_name,email', 'Alice,alice@test.com');
    const { rows, errors } = await parseCsvBuffer(buf);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/phone column/i);
  });

  it('returns an error for empty CSV', async () => {
    const buf = csv('');
    const { rows, errors } = await parseCsvBuffer(buf);
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('includes csvRowData for downstream use', async () => {
    const buf = csv(
      'first_name,last_name,phone,custom_field',
      'Alice,Smith,+12125551234,vip'
    );
    const { rows } = await parseCsvBuffer(buf);
    expect(rows[0]!.csvRowData['custom_field']).toBe('vip');
  });
});
