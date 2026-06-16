import type { MappedAssetRow } from './csvParser.js';

export type DuplicateStrategy = 'error' | 'skip' | 'overwrite';

export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
  code: string;
}

export interface ValidatedRow {
  rowIndex: number;
  isValid: boolean;
  data: ParsedAssetData;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ParsedAssetData {
  date: string;
  cash: number;
  longTermInvest: number;
  stableBond: number;
  note: string;
}

const DATE_PATTERNS: RegExp[] = [
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{4}\/\d{2}\/\d{2}$/,
  /^\d{4}\.\d{2}\.\d{2}$/,
  /^\d{4}年\d{1,2}月\d{1,2}日?$/,
  /^\d{1,2}\/\d{1,2}\/\d{4}$/,
];

const NUMBER_PATTERN = /^-?\d+(\.\d{1,2})?$/;

export function normalizeDate(rawDate: string): string | null {
  const date = rawDate.trim();
  if (!date) return null;

  let matched = DATE_PATTERNS.find(p => p.test(date));
  if (!matched) return null;

  try {
    let year = 0, month = 0, day = 0;

    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      [year, month, day] = date.split('-').map(Number);
    } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(date)) {
      [year, month, day] = date.split('/').map(Number);
    } else if (/^\d{4}\.\d{2}\.\d{2}$/.test(date)) {
      [year, month, day] = date.split('.').map(Number);
    } else if (/^\d{4}年\d{1,2}月\d{1,2}日?$/.test(date)) {
      const match = date.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
      if (match) {
        year = Number(match[1]);
        month = Number(match[2]);
        day = Number(match[3]);
      }
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
      const [m, d, y] = date.split('/').map(Number);
      month = m;
      day = d;
      year = y;
    }

    if (year < 1970 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const normalizedDate = new Date(year, month - 1, day);
    if (normalizedDate.getFullYear() !== year ||
        normalizedDate.getMonth() !== month - 1 ||
        normalizedDate.getDate() !== day) {
      return null;
    }

    const yyyy = String(year);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return null;
  }
}

export function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/[,，]/g, '');
  if (!cleaned) return 0;
  if (!NUMBER_PATTERN.test(cleaned)) return null;
  const value = Number(cleaned);
  if (isNaN(value) || !isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

export function parseAssetRow(row: MappedAssetRow): { data: ParsedAssetData; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const data: ParsedAssetData = {
    date: '',
    cash: 0,
    longTermInvest: 0,
    stableBond: 0,
    note: row.note.trim().slice(0, 100),
  };

  const normalizedDate = normalizeDate(row.date);
  if (!normalizedDate) {
    errors.push({
      rowIndex: row.rowIndex,
      field: 'date',
      message: `日期格式无效：${row.date || '(空)'}，支持格式：YYYY-MM-DD、YYYY/MM/DD等`,
      code: 'INVALID_DATE',
    });
  } else {
    data.date = normalizedDate;
  }

  const cashValue = parseAmount(row.cash);
  if (cashValue === null) {
    errors.push({
      rowIndex: row.rowIndex,
      field: 'cash',
      message: `活钱金额格式无效：${row.cash}`,
      code: 'INVALID_CASH',
    });
  } else if (cashValue < 0) {
    errors.push({
      rowIndex: row.rowIndex,
      field: 'cash',
      message: `活钱金额不能为负数：${cashValue}`,
      code: 'NEGATIVE_CASH',
    });
  } else {
    data.cash = cashValue;
  }

  const longTermValue = parseAmount(row.longTermInvest);
  if (longTermValue === null) {
    errors.push({
      rowIndex: row.rowIndex,
      field: 'longTermInvest',
      message: `长期投资金额格式无效：${row.longTermInvest}`,
      code: 'INVALID_LONG_TERM',
    });
  } else if (longTermValue < 0) {
    errors.push({
      rowIndex: row.rowIndex,
      field: 'longTermInvest',
      message: `长期投资金额不能为负数：${longTermValue}`,
      code: 'NEGATIVE_LONG_TERM',
    });
  } else {
    data.longTermInvest = longTermValue;
  }

  const bondValue = parseAmount(row.stableBond);
  if (bondValue === null) {
    errors.push({
      rowIndex: row.rowIndex,
      field: 'stableBond',
      message: `稳定债券金额格式无效：${row.stableBond}`,
      code: 'INVALID_BOND',
    });
  } else if (bondValue < 0) {
    errors.push({
      rowIndex: row.rowIndex,
      field: 'stableBond',
      message: `稳定债券金额不能为负数：${bondValue}`,
      code: 'NEGATIVE_BOND',
    });
  } else {
    data.stableBond = bondValue;
  }

  if (errors.length === 0) {
    const total = data.cash + data.longTermInvest + data.stableBond;
    if (total <= 0) {
      errors.push({
        rowIndex: row.rowIndex,
        field: 'total',
        message: '至少需要有一项资产金额大于0',
        code: 'ALL_ZERO',
      });
    }
  }

  if (row.note.length > 100) {
    errors.push({
      rowIndex: row.rowIndex,
      field: 'note',
      message: `备注超过100字，将被截断`,
      code: 'NOTE_TOO_LONG',
    });
  }

  return { data, errors };
}

export function validateMappedRows(
  rows: MappedAssetRow[],
  existingDates: string[],
  duplicateStrategy: DuplicateStrategy = 'error'
): ValidatedRow[] {
  const validated: ValidatedRow[] = [];
  const seenDatesInBatch = new Map<string, number[]>();

  for (const row of rows) {
    const { data, errors } = parseAssetRow(row);
    const warnings: ValidationError[] = [];

    if (errors.length === 0 && data.date) {
      if (!seenDatesInBatch.has(data.date)) {
        seenDatesInBatch.set(data.date, []);
      }
      seenDatesInBatch.get(data.date)!.push(row.rowIndex);
    }

    validated.push({
      rowIndex: row.rowIndex,
      isValid: errors.length === 0,
      data,
      errors,
      warnings,
    });
  }

  for (const [date, indices] of seenDatesInBatch.entries()) {
    if (indices.length > 1) {
      for (const idx of indices) {
        const row = validated.find(r => r.rowIndex === idx)!;
        if (duplicateStrategy === 'error') {
          row.errors.push({
            rowIndex: idx,
            field: 'date',
            message: `当前批次中存在重复日期：${date}（出现 ${indices.length} 次）`,
            code: 'DUPLICATE_IN_BATCH',
          });
          row.isValid = false;
        } else if (duplicateStrategy === 'skip') {
          row.warnings.push({
            rowIndex: idx,
            field: 'date',
            message: `当前批次中存在重复日期：${date}，仅保留第一条，其余将被跳过`,
            code: 'DUPLICATE_IN_BATCH_SKIP',
          });
          if (indices.indexOf(idx) > 0) {
            row.isValid = false;
            row.errors.push({
              rowIndex: idx,
              field: 'date',
              message: `重复日期，已跳过`,
              code: 'SKIPPED_DUPLICATE',
            });
          }
        } else {
          row.warnings.push({
            rowIndex: idx,
            field: 'date',
            message: `当前批次中存在重复日期：${date}，将以最后一条为准覆盖`,
            code: 'DUPLICATE_IN_BATCH_OVERWRITE',
          });
        }
      }
    }
  }

  const existingDateSet = new Set(existingDates);
  for (const row of validated) {
    if (!row.isValid) continue;
    if (existingDateSet.has(row.data.date)) {
      if (duplicateStrategy === 'error') {
        row.errors.push({
          rowIndex: row.rowIndex,
          field: 'date',
          message: `日期已存在：${row.data.date}`,
          code: 'DATE_EXISTS',
        });
        row.isValid = false;
      } else if (duplicateStrategy === 'skip') {
        row.warnings.push({
          rowIndex: row.rowIndex,
          field: 'date',
          message: `日期已存在，将跳过导入：${row.data.date}`,
          code: 'DATE_EXISTS_SKIP',
        });
        row.isValid = false;
      } else {
        row.warnings.push({
          rowIndex: row.rowIndex,
          field: 'date',
          message: `日期已存在，将覆盖原有记录：${row.data.date}`,
          code: 'DATE_EXISTS_OVERWRITE',
        });
      }
    }
  }

  return validated;
}
