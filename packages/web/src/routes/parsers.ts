import { Router } from 'express';
import { listParsers } from '@banksheet/core';

const router = Router();

router.get('/parsers', (_req, res) => {
  res.json({ parsers: listParsers() });
});

export { router as parsersRouter };
