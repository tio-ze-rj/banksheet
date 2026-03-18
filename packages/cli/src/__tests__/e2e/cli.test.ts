import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);
const CLI = path.resolve(__dirname, '../../../src/index.ts');
const ROOT = path.resolve(__dirname, '../../../../..');

function run(args: string[]) {
  return exec('npx', ['tsx', CLI, ...args], {
    cwd: ROOT,
    shell: true,
    timeout: 15000,
  });
}

describe('CLI E2E', () => {
  describe('list command', () => {
    it('shows available parsers', async () => {
      const { stdout } = await run(['list']);
      expect(stdout).toContain('Itaú Cartão');
      expect(stdout).toContain('BR');
    });

    it('shows parser count', async () => {
      const { stdout } = await run(['list']);
      expect(stdout).toContain('1 parser(s)');
    });
  });

  describe('help', () => {
    it('shows help text with no args', async () => {
      const { stdout } = await run(['--help']);
      expect(stdout).toContain('banksheet');
      expect(stdout).toContain('parse');
      expect(stdout).toContain('list');
    });

    it('shows version', async () => {
      const { stdout } = await run(['--version']);
      expect(stdout.trim()).toBe('0.1.0');
    });

    it('shows parse command help', async () => {
      const { stdout } = await run(['parse', '--help']);
      expect(stdout).toContain('--format');
      expect(stdout).toContain('--output');
      expect(stdout).toContain('--bank');
    });
  });

  describe('parse command errors', () => {
    it('exits with error for nonexistent file', async () => {
      await expect(run(['parse', 'nonexistent.pdf'])).rejects.toThrow();
    });

    it('exits with error for unknown bank', async () => {
      // Create a minimal file that exists but will fail bank detection
      const fs = await import('node:fs');
      const tmpFile = path.join(ROOT, 'packages/cli/src/__tests__/e2e/tmp-test.txt');
      fs.writeFileSync(tmpFile, 'not a real pdf');
      try {
        await expect(run(['parse', tmpFile, '--bank', 'Unknown Bank'])).rejects.toThrow();
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });
});
