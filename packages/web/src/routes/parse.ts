import { Router } from 'express';
import multer from 'multer';
import { extractText, parseStatement, plugins } from '@banksheet/core';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

router.post('/parse', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file uploaded. Use field name "pdf".' });
      return;
    }

    const text = await extractText(req.file.buffer);
    const result = parseStatement(text, plugins);

    res.json({
      bank: result.bank,
      transactions: result.transactions,
      total: result.total,
      currency: result.currency,
      count: result.transactions.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(422).json({ error: message });
  }
});

export { router as parseRouter };
