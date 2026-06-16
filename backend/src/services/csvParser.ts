import { Readable } from 'stream';

export interface CsvParseOptions {
  encoding?: string;
  delimiter?: string;
  hasHeader?: boolean;
  skipEmptyLines?: boolean;
  chunkSize?: number;
}

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  encoding: string;
  delimiter: string;
  totalRows: number;
}

const BOM_MAP: Record<string, string> = {
  '\uFEFF': 'UTF-8',
  '\uFFFE': 'UTF-16LE',
  '\uFEFF00': 'UTF-16BE',
};

const COMMON_DELIMITERS = [',', '\t', ';', '|'];

export function detectEncoding(buffer: Buffer): { encoding: string; content: Buffer } {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { encoding: 'UTF-8', content: buffer.subarray(3) };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { encoding: 'UTF-16LE', content: buffer.subarray(2) };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { encoding: 'UTF-16BE', content: buffer.subarray(2) };
  }
  return { encoding: 'UTF-8', content: buffer };
}

export function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).filter(line => line.trim().length > 0);
  if (firstLines.length === 0) return ',';

  let bestDelimiter = ',';
  let bestScore = 0;

  for (const delimiter of COMMON_DELIMITERS) {
    let totalCount = 0;
    let consistent = true;
    let firstLineCount = -1;

    for (const line of firstLines) {
      const count = countDelimiter(line, delimiter);
      totalCount += count;
      if (firstLineCount === -1) {
        firstLineCount = count;
      } else if (count !== firstLineCount && count > 0) {
        consistent = false;
        break;
      }
    }

    const score = consistent && firstLineCount > 0 ? totalCount + 10 : totalCount;
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      count++;
    }
  }
  return count;
}

export function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  result.push(current);
  return result.map(field => field.trim());
}

export function parseCsvSync(content: string, options: CsvParseOptions = {}): CsvParseResult {
  const {
    delimiter: explicitDelimiter,
    hasHeader = true,
    skipEmptyLines = true,
  } = options;

  const delimiter = explicitDelimiter || detectDelimiter(content);
  const lines = content.split(/\r?\n/);

  let headers: string[] = [];
  const rows: string[][] = [];
  let startIndex = 0;

  if (hasHeader && lines.length > 0) {
    headers = parseCsvLine(lines[0], delimiter);
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (skipEmptyLines && line.trim().length === 0) {
      continue;
    }
    const row = parseCsvLine(line, delimiter);
    rows.push(row);
  }

  if (headers.length === 0 && rows.length > 0) {
    headers = rows[0].map((_, idx) => `列${idx + 1}`);
  }

  return {
    headers,
    rows,
    encoding: options.encoding || 'UTF-8',
    delimiter,
    totalRows: rows.length,
  };
}

export async function parseCsvStream(
  stream: Readable,
  options: CsvParseOptions & { maxRows?: number } = {}
): Promise<CsvParseResult> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }

  const buffer = Buffer.concat(chunks);
  const { encoding, content } = detectEncoding(buffer);
  const text = content.toString(encoding === 'UTF-16LE' || encoding === 'UTF-16BE' ? 'utf16le' : 'utf8');

  const result = parseCsvSync(text, { ...options, encoding });

  if (options.maxRows && result.rows.length > options.maxRows) {
    result.rows = result.rows.slice(0, options.maxRows);
  }

  return result;
}

export type AssetFieldKey = 'date' | 'cash' | 'longTermInvest' | 'stableBond' | 'note';

export interface ColumnMapping {
  [key: string]: AssetFieldKey | null;
}

export interface MappedAssetRow {
  rowIndex: number;
  rawData: Record<string, string>;
  date: string;
  cash: string;
  longTermInvest: string;
  stableBond: string;
  note: string;
}

export function applyColumnMapping(
  parseResult: CsvParseResult,
  mapping: ColumnMapping
): MappedAssetRow[] {
  const { headers, rows } = parseResult;
  const fieldToColumnIdx: Partial<Record<AssetFieldKey, number>> = {};

  headers.forEach((header, idx) => {
    const field = mapping[header];
    if (field) {
      fieldToColumnIdx[field] = idx;
    }
  });

  return rows.map((row, rowIndex) => {
    const rawData: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rawData[header] = row[idx] || '';
    });

    return {
      rowIndex: rowIndex + 2,
      rawData,
      date: getFieldValue(row, fieldToColumnIdx.date) || '',
      cash: getFieldValue(row, fieldToColumnIdx.cash) || '0',
      longTermInvest: getFieldValue(row, fieldToColumnIdx.longTermInvest) || '0',
      stableBond: getFieldValue(row, fieldToColumnIdx.stableBond) || '0',
      note: getFieldValue(row, fieldToColumnIdx.note) || '',
    };
  });
}

function getFieldValue(row: string[], idx?: number): string {
  if (idx === undefined || idx < 0 || idx >= row.length) return '';
  return row[idx] || '';
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const dateKeywords = ['日期', 'date', '时间', 'day'];
  const cashKeywords = ['活钱', '现金', 'cash', '活期'];
  const longTermKeywords = ['长期', '股票', '投资', 'long', 'invest', 'stock', '权益'];
  const bondKeywords = ['债券', '稳健', '稳定', '固收', 'bond', 'fixed'];
  const noteKeywords = ['备注', '说明', 'note', 'remark', 'comment'];

  headers.forEach((header) => {
    const lowerHeader = header.toLowerCase();
    let matched: AssetFieldKey | null = null;

    if (dateKeywords.some(k => lowerHeader.includes(k.toLowerCase()))) {
      matched = 'date';
    } else if (cashKeywords.some(k => lowerHeader.includes(k.toLowerCase()))) {
      matched = 'cash';
    } else if (longTermKeywords.some(k => lowerHeader.includes(k.toLowerCase()))) {
      matched = 'longTermInvest';
    } else if (bondKeywords.some(k => lowerHeader.includes(k.toLowerCase()))) {
      matched = 'stableBond';
    } else if (noteKeywords.some(k => lowerHeader.includes(k.toLowerCase()))) {
      matched = 'note';
    }

    mapping[header] = matched;
  });

  return mapping;
}
