import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflowUrl = new URL('../../../.github/workflows/ci.yml', import.meta.url);

describe('CI workflow runtime configuration', () => {
  it('pins the runner and uses updated actions without changing application Node', async () => {
    const workflow = await readFile(workflowUrl, 'utf8');

    expect(workflow).toMatch(/runs-on:\s+ubuntu-24\.04\b/);
    expect(workflow).toMatch(/uses:\s+actions\/checkout@v5\b/);
    expect(workflow).toMatch(/uses:\s+actions\/setup-node@v5\b/);
    expect(workflow).toMatch(/node-version:\s+22\b/);
  });
});