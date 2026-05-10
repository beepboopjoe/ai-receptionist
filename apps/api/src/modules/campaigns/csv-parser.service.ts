import { parse } from 'csv-parse';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface ParsedLead {
  phoneE164: string;
  firstName: string;
  lastName: string;
  email: string | null;
  csvRowData: Record<string, string>;
}

export interface CsvParseResult {
  rows: ParsedLead[];
  errors: string[];
}

const MAX_ROWS = 10_000;

// Flexible column-name matching (case-insensitive, strips spaces/underscores)
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_-]/g, '');
}

function findCol(headers: string[], ...keys: string[]): string | undefined {
  const targets = keys.map(norm);
  return headers.find((h) => targets.includes(norm(h)));
}

/**
 * Parse a CSV buffer into an array of normalised leads.
 * Returns rows (valid) and errors (row-level validation failures).
 */
export async function parseCsvBuffer(buffer: Buffer): Promise<CsvParseResult> {
  const rows: ParsedLead[] = [];
  const errors: string[] = [];

  const records: Record<string, string>[] = await new Promise((resolve, reject) => {
    parse(
      buffer,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: false,
        to: MAX_ROWS + 1, // read one extra so we can detect overflow
      },
      (err, data) => {
        if (err) reject(err);
        else resolve(data as Record<string, string>[]);
      }
    );
  });

  if (records.length === 0) {
    return { rows: [], errors: ['CSV file is empty or has no data rows'] };
  }

  if (records.length > MAX_ROWS) {
    errors.push(`CSV exceeds the ${MAX_ROWS.toLocaleString()} row limit. Only the first ${MAX_ROWS.toLocaleString()} rows will be imported.`);
  }

  const headers = Object.keys(records[0]);

  // Detect columns
  const phoneCol = findCol(headers, 'phone', 'phone_e164', 'phonenumber', 'mobile', 'cell', 'telephone');
  const firstNameCol = findCol(headers, 'firstname', 'first_name', 'first', 'given_name');
  const lastNameCol = findCol(headers, 'lastname', 'last_name', 'last', 'surname', 'family_name');
  const emailCol = findCol(headers, 'email', 'email_address', 'emailaddress');

  if (!phoneCol) {
    return { rows: [], errors: ['CSV must have a phone column (e.g. "phone", "mobile", "telephone")'] };
  }
  if (!firstNameCol) {
    return { rows: [], errors: ['CSV must have a first name column (e.g. "first_name", "firstname")'] };
  }

  const toProcess = records.slice(0, MAX_ROWS);

  for (let i = 0; i < toProcess.length; i++) {
    const record = toProcess[i];
    const rowNum = i + 2; // 1-indexed + header row

    const rawPhone = record[phoneCol]?.trim() ?? '';
    const firstName = record[firstNameCol]?.trim() ?? '';
    const lastName = lastNameCol ? (record[lastNameCol]?.trim() ?? '') : '';
    const email = emailCol ? (record[emailCol]?.trim() || null) : null;

    if (!firstName) {
      errors.push(`Row ${rowNum}: missing first name`);
      continue;
    }
    if (!rawPhone) {
      errors.push(`Row ${rowNum}: missing phone number`);
      continue;
    }

    // Attempt E.164 normalisation — try US first, then any country
    let phoneE164: string | undefined;
    const parsed = parsePhoneNumberFromString(rawPhone, 'US');
    if (parsed?.isValid()) {
      phoneE164 = parsed.number as string;
    } else {
      const parsed2 = parsePhoneNumberFromString(rawPhone);
      if (parsed2?.isValid()) phoneE164 = parsed2.number as string;
    }

    if (!phoneE164) {
      errors.push(`Row ${rowNum}: invalid phone number "${rawPhone}"`);
      continue;
    }

    rows.push({
      phoneE164,
      firstName,
      lastName,
      email,
      csvRowData: record,
    });
  }

  return { rows, errors };
}
