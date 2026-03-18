import { Router } from 'express';
import { exportCSV, exportJSON, exportExcel } from '@banksheet/core';
import type { Transaction } from '@banksheet/core';

const router = Router();

router.post('/export', async (req, res) => {
  try {
    const { transactions, format } = req.body as { transactions: Transaction[]; format: string };

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      res.status(400).json({ error: 'Missing or empty transactions array.' });
      return;
    }

    if (!format || !['csv', 'json', 'excel'].includes(format)) {
      res.status(400).json({ error: 'Invalid format. Use "csv", "json", or "excel".' });
      return;
    }

    switch (format) {
      case 'csv': {
        const csv = exportCSV(transactions);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
        res.send(csv);
        break;
      }
      case 'json': {
        const json = exportJSON(transactions);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.json"');
        res.send(json);
        break;
      }
      case 'excel': {
        const buffer = await exportExcel(transactions);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.xlsx"');
        res.send(buffer);
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export { router as exportRouter };
