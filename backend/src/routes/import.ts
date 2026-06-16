import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  parseCsvStream,
  detectEncoding,
  detectDelimiter,
  applyColumnMapping,
  suggestColumnMapping,
  type ColumnMapping,
  type MappedAssetRow,
} from '../services/csvParser.js';
import {
  batchValidate,
  batchImport,
  getImportResult,
  type BatchValidateRequest,
  type BatchImportRequest,
} from '../services/assetImportService.js';
import { Readable } from 'stream';
import type { DuplicateStrategy } from '../services/assetValidator.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: '访问令牌无效或已过期' });
  }
}

router.post('/parse', authMiddleware, async (req: any, res: any) => {
  try {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: '请使用 multipart/form-data 格式上传文件' });
    }

    const chunks: Buffer[] = [];
    let fileSize = 0;
    let fileName = '';
    let boundary = '';

    const match = contentType.match(/boundary=(.+)$/);
    if (match) boundary = match[1];

    for await (const chunk of req) {
      chunks.push(chunk);
      fileSize += chunk.length;
      if (fileSize > MAX_FILE_SIZE) {
        return res.status(413).json({ error: '文件大小超过限制（最大50MB）' });
      }
    }

    const buffer = Buffer.concat(chunks);
    const { fileBuffer, originalName } = extractFileFromMultipart(buffer, boundary);
    fileName = originalName || 'upload.csv';

    const { encoding, content } = detectEncoding(fileBuffer);
    const text = content.toString(encoding === 'UTF-16LE' || encoding === 'UTF-16BE' ? 'utf16le' : 'utf8');
    const delimiter = detectDelimiter(text);

    const previewResult = await parseCsvStream(Readable.from(fileBuffer), {
      encoding,
      delimiter,
      maxRows: 100,
    });

    const suggestedMapping = suggestColumnMapping(previewResult.headers);

    const totalLines = text.split(/\r?\n/).filter(l => l.trim()).length;

    res.json({
      fileName,
      fileSize,
      encoding,
      delimiter,
      headers: previewResult.headers,
      previewRows: previewResult.rows,
      totalRows: Math.max(0, totalLines - 1),
      suggestedMapping,
    });
  } catch (error: any) {
    console.error('Parse CSV error:', error);
    res.status(500).json({ error: error?.message || '解析CSV文件失败' });
  }
});

router.post('/apply-mapping', authMiddleware, async (req: any, res: any) => {
  try {
    const { headers, rows, mapping } = req.body as {
      headers: string[];
      rows: string[][];
      mapping: ColumnMapping;
    };

    if (!headers || !rows || !mapping) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const parseResult = {
      headers,
      rows,
      encoding: 'UTF-8',
      delimiter: ',',
      totalRows: rows.length,
    };

    const mappedRows: MappedAssetRow[] = applyColumnMapping(parseResult, mapping);

    const requiredFields = ['date', 'cash', 'longTermInvest', 'stableBond'];
    const usedFields = new Set(Object.values(mapping).filter(Boolean));
    const missingFields = requiredFields.filter(f => !usedFields.has(f as any));

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `缺少必要字段映射：${missingFields.join('、')}`,
        missingFields,
      });
    }

    res.json({
      mappedRows,
    });
  } catch (error: any) {
    console.error('Apply mapping error:', error);
    res.status(500).json({ error: error?.message || '应用列映射失败' });
  }
});

router.post('/validate', authMiddleware, async (req: any, res: any) => {
  try {
    const body = req.body as BatchValidateRequest;
    if (!body.rows || !Array.isArray(body.rows)) {
      return res.status(400).json({ error: 'rows 参数必须为数组' });
    }

    const strategies: DuplicateStrategy[] = ['error', 'skip', 'overwrite'];
    if (body.duplicateStrategy && !strategies.includes(body.duplicateStrategy)) {
      return res.status(400).json({ error: '无效的重复日期处理策略' });
    }

    const result = await batchValidate(req.userId, body);
    res.json(result);
  } catch (error: any) {
    console.error('Batch validate error:', error);
    res.status(500).json({ error: error?.message || '批量校验失败' });
  }
});

router.post('/import', authMiddleware, async (req: any, res: any) => {
  try {
    const body = req.body as BatchImportRequest;
    if (!body.rows || !Array.isArray(body.rows)) {
      return res.status(400).json({ error: 'rows 参数必须为数组' });
    }

    const strategies: DuplicateStrategy[] = ['error', 'skip', 'overwrite'];
    if (body.duplicateStrategy && !strategies.includes(body.duplicateStrategy)) {
      return res.status(400).json({ error: '无效的重复日期处理策略' });
    }

    const result = await batchImport(req.userId, body);
    res.json(result);
  } catch (error: any) {
    console.error('Batch import error:', error);
    res.status(500).json({ error: error?.message || '批量导入失败' });
  }
});

router.get('/import/:importId', authMiddleware, async (req: any, res: any) => {
  try {
    const { importId } = req.params;
    const result = getImportResult(req.userId, importId);

    if (!result) {
      return res.status(404).json({ error: '导入结果不存在或已过期' });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Get import result error:', error);
    res.status(500).json({ error: error?.message || '获取导入结果失败' });
  }
});

function extractFileFromMultipart(buffer: Buffer, boundary: string): { fileBuffer: Buffer; originalName: string } {
  const boundaryBuffer = Buffer.from('--' + boundary);
  const endBoundaryBuffer = Buffer.from('--' + boundary + '--');

  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < buffer.length - boundaryBuffer.length; i++) {
    if (buffer.slice(i, i + boundaryBuffer.length).equals(boundaryBuffer)) {
      if (startIdx === -1) {
        startIdx = i;
      } else {
        endIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1) {
    return { fileBuffer: buffer, originalName: 'upload.csv' };
  }

  if (endIdx === -1) {
    for (let i = 0; i < buffer.length - endBoundaryBuffer.length; i++) {
      if (buffer.slice(i, i + endBoundaryBuffer.length).equals(endBoundaryBuffer)) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx === -1) {
    endIdx = buffer.length;
  }

  const part = buffer.slice(startIdx + boundaryBuffer.length, endIdx);

  const headerEnd = part.indexOf('\r\n\r\n');
  if (headerEnd === -1) {
    return { fileBuffer: buffer, originalName: 'upload.csv' };
  }

  const header = part.slice(0, headerEnd).toString('utf8');
  const fileBuffer = part.slice(headerEnd + 4);

  const nameMatch = header.match(/filename="([^"]+)"/);
  const originalName = nameMatch ? nameMatch[1] : 'upload.csv';

  const trimmedEnd = fileBuffer.length >= 2 && fileBuffer[fileBuffer.length - 2] === 0x0d && fileBuffer[fileBuffer.length - 1] === 0x0a
    ? fileBuffer.slice(0, -2)
    : fileBuffer;

  return { fileBuffer: trimmedEnd, originalName };
}

export default router;
