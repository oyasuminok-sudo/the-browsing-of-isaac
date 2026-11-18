import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { webkit } from 'playwright';

const buildDir = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the directory containing the web smoke module');

const html = `<!doctype html>
<meta charset="utf-8">
<title>Asyncify WebKit smoke test</title>
<script type="module">
  import createModule from '/asyncify-smoke.mjs';
  (async () => {
    try {
      let M;
      M = await createModule({
        isaacLazyPread(src, dst, off, len) {
          if (off !== 17 || len !== 4) throw new Error('unexpected read window');
          const bytes = src === 'asset' || src === 'sync' ? [10, 20, 30, 40] : null;
          if (!bytes) throw new Error('unexpected source: ' + src);
          const put = () => { M.HEAPU8.set(bytes.slice(0, len), dst); return len; };
          if (src === 'asset') return new Promise((resolve) => setTimeout(() => resolve(put()), 1));
          return put();
        }
      });
      const asyncResult = await M.ccall('async_pread_entry', 'number', [], [], { async: true });
      const syncResult = await M.ccall('sync_pread_entry', 'number', [], [], { async: true });
      window.__asyncifyResult = { done: true, ok: asyncResult === 10203040 && syncResult === 10203040, asyncResult, syncResult };
    } catch (error) {
      window.__asyncifyResult = { done: true, ok: false, error: String(error && (error.stack || error)) };
    }
  })();
</script>`;

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    if (pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    const name = pathname.slice(1);
    if (!['asyncify-smoke.mjs', 'asyncify-smoke.wasm'].includes(name)) {
      res.writeHead(404); res.end('not found'); return;
    }
    const body = await readFile(resolve(buildDir, name));
    res.writeHead(200, {
      'content-type': name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript; charset=utf-8',
      'content-length': body.length
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500); res.end(String(error));
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => { throw error; });
  const address = server.address();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => window.__asyncifyResult?.done === true, null, { timeout: 30000 });
  const result = await page.evaluate(() => window.__asyncifyResult);
  if (!result.ok) throw new Error(`WebKit Asyncify smoke failed: ${JSON.stringify(result)}`);
  process.stdout.write('WebKit Asyncify lazy archive read (Promise + sync cache hit): PASS\\n');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
