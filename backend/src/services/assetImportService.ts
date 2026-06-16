import { prisma } from '../index.js';
import type { MappedAssetRow } from './csvParser.js';
import {
  validateMappedRows,
  type ValidatedRow,
  type DuplicateStrategy,
  type ParsedAssetData,
} from './assetValidator.js';
import { eventBus, EVENTS } from './eventBus.js';

export interface BatchValidateRequest {
  rows: MappedAssetRow[];
  duplicateStrategy?: DuplicateStrategy;
}

export interface BatchValidateResponse {
  totalCount: number;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  rows: ValidatedRow[];
}

export interface BatchImportRequest {
  rows: MappedAssetRow[];
  duplicateStrategy?: DuplicateStrategy;
  skipInvalidRows?: boolean;
  importId?: string;
}

export interface ImportSuccessDetail {
  rowIndex: number;
  date: string;
  recordId: string;
  created: boolean;
  overwritten: boolean;
}

export interface ImportFailDetail {
  rowIndex: number;
  errors: { field: string; message: string; code: string }[];
}

export interface BatchImportResponse {
  importId: string;
  totalCount: number;
  successCount: number;
  failCount: number;
  skippedCount: number;
  successDetails: ImportSuccessDetail[];
  failDetails: ImportFailDetail[];
  createdAt: string;
}

export async function batchValidate(
  userId: string,
  request: BatchValidateRequest
): Promise<BatchValidateResponse> {
  const { rows, duplicateStrategy = 'error' } = request;

  const existingRecords = await prisma.assetRecord.findMany({
    where: { userId },
    select: { date: true },
  });
  const existingDates = existingRecords.map(r => r.date.toISOString().split('T')[0]);

  const validatedRows = validateMappedRows(rows, existingDates, duplicateStrategy);

  const validCount = validatedRows.filter(r => r.isValid).length;
  const invalidCount = validatedRows.filter(r => !r.isValid).length;
  const warningCount = validatedRows.filter(r => r.warnings.length > 0).length;

  return {
    totalCount: validatedRows.length,
    validCount,
    invalidCount,
    warningCount,
    rows: validatedRows,
  };
}

export async function batchImport(
  userId: string,
  request: BatchImportRequest
): Promise<BatchImportResponse> {
  const {
    rows,
    duplicateStrategy = 'error',
    skipInvalidRows = true,
  } = request;

  const importId = request.importId || generateImportId();
  const importCacheKey = `import_${userId}_${importId}`;

  const cached = importResultCache.get(importCacheKey);
  if (cached) {
    return cached;
  }

  const existingRecords = await prisma.assetRecord.findMany({
    where: { userId },
    select: { id: true, date: true, cash: true, longTermInvest: true, stableBond: true, total: true, note: true },
  });
  const existingDatesMap = new Map<string, typeof existingRecords[0]>();
  existingRecords.forEach(r => {
    existingDatesMap.set(r.date.toISOString().split('T')[0], r);
  });
  const existingDates = Array.from(existingDatesMap.keys());

  const validatedRows = validateMappedRows(rows, existingDates, duplicateStrategy);

  const successDetails: ImportSuccessDetail[] = [];
  const failDetails: ImportFailDetail[] = [];
  let skippedCount = 0;

  const rowsToImport: { validated: ValidatedRow; data: ParsedAssetData }[] = [];
  const seenDates = new Set<string>();

  for (const validated of validatedRows) {
    if (!validated.isValid) {
      if (skipInvalidRows) {
        skippedCount++;
        failDetails.push({
          rowIndex: validated.rowIndex,
          errors: validated.errors.map(e => ({ field: e.field, message: e.message, code: e.code })),
        });
      } else {
        failDetails.push({
          rowIndex: validated.rowIndex,
          errors: validated.errors.map(e => ({ field: e.field, message: e.message, code: e.code })),
        });
      }
      continue;
    }

    const { date } = validated.data;

    if (duplicateStrategy === 'skip' && seenDates.has(date)) {
      skippedCount++;
      continue;
    }

    if (duplicateStrategy === 'overwrite') {
      seenDates.delete(date);
    }
    seenDates.add(date);

    rowsToImport.push({ validated, data: validated.data });
  }

  if (duplicateStrategy === 'overwrite') {
    const dateOrderMap = new Map<string, typeof rowsToImport[number]>();
    for (const item of rowsToImport) {
      dateOrderMap.set(item.data.date, item);
    }
    rowsToImport.length = 0;
    for (const item of dateOrderMap.values()) {
      rowsToImport.push(item);
    }
  }

  const transactionResult = await prisma.$transaction(async (tx) => {
    const txSuccessDetails: ImportSuccessDetail[] = [];

    for (const { validated, data } of rowsToImport) {
      const total = data.cash + data.longTermInvest + data.stableBond;
      const existingRecord = existingDatesMap.get(data.date);

      try {
        if (existingRecord && duplicateStrategy === 'overwrite') {
          const updated = await tx.assetRecord.update({
            where: { id: existingRecord.id },
            data: {
              cash: data.cash,
              longTermInvest: data.longTermInvest,
              stableBond: data.stableBond,
              total,
              note: data.note || null,
            },
          });

          txSuccessDetails.push({
            rowIndex: validated.rowIndex,
            date: data.date,
            recordId: updated.id,
            created: false,
            overwritten: true,
          });
        } else if (!existingRecord) {
          const created = await tx.assetRecord.create({
            data: {
              userId,
              date: new Date(data.date),
              cash: data.cash,
              longTermInvest: data.longTermInvest,
              stableBond: data.stableBond,
              total,
              note: data.note || null,
            },
          });

          txSuccessDetails.push({
            rowIndex: validated.rowIndex,
            date: data.date,
            recordId: created.id,
            created: true,
            overwritten: false,
          });
        } else {
          skippedCount++;
        }
      } catch (error: any) {
        failDetails.push({
          rowIndex: validated.rowIndex,
          errors: [{
            field: 'database',
            message: error?.message || '数据库写入失败',
            code: 'DB_ERROR',
          }],
        });
      }
    }

    return txSuccessDetails;
  });

  successDetails.push(...transactionResult);

  for (const detail of successDetails) {
    if (detail.created) {
      eventBus.emit(EVENTS.ASSET_RECORD_CREATED, {
        userId,
        recordId: detail.recordId,
        date: detail.date,
      }).catch(console.error);
    }
  }

  const response: BatchImportResponse = {
    importId,
    totalCount: validatedRows.length,
    successCount: successDetails.length,
    failCount: failDetails.length,
    skippedCount,
    successDetails,
    failDetails,
    createdAt: new Date().toISOString(),
  };

  importResultCache.set(importCacheKey, response);
  setTimeout(() => importResultCache.delete(importCacheKey), 1000 * 60 * 60);

  return response;
}

function generateImportId(): string {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const importResultCache = new Map<string, BatchImportResponse>();

export function getImportResult(userId: string, importId: string): BatchImportResponse | null {
  const key = `import_${userId}_${importId}`;
  return importResultCache.get(key) || null;
}
