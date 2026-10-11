import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('hosted HTML parser loading', () => {
  it('loads the real parser without relying on Node require(ESM) support', () => {
    // The hosted workflow crashed before claiming any SQL job when a CommonJS
    // jsdom dependency required an ESM-only encoding module. Vite masks this.
    const result = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', `
      const { JSDOM, VirtualConsole } = require('jsdom');
      const { Readability } = require('@mozilla/readability');
      const dom = new JSDOM('<article><h1>Lesson</h1><p>' +
        'Light transport describes how energy interacts with surfaces. '.repeat(20) +
        '</p><script>throw new Error("must stay inert")</script></article>',
        { virtualConsole: new VirtualConsole() });
      try {
        const article = new Readability(dom.window.document).parse();
        if (!article || !article.textContent.includes('Light transport')) process.exit(1);
        console.log('parser-ready');
      } finally { dom.window.close(); }
    `], { encoding: 'utf8', timeout: 15_000 });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('parser-ready');
  });
});
