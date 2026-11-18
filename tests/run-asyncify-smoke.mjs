import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const wasmModulePath = process.argv[2];
if (!wasmModulePath) throw new Error('Pass the generated Asyncify module path');

let module;
const expected = [10, 20, 30, 40];
module = await (await import(pathToFileURL(resolve(wasmModulePath)).href)).default({
  isaacLazyPread(src, dst, off, len) {
    if (off !== 17 || len !== 4) throw new Error(`unexpected read window: ${src}@${off}+${len}`);
    const bytes = src === 'asset' || src === 'sync' ? expected : null;
    if (!bytes) throw new Error(`unexpected source: ${src}`);
    const put = () => {
      module.HEAPU8.set(bytes.slice(0, len), dst);
      return len;
    };
    if (src === 'asset') return new Promise((resolve) => setTimeout(() => resolve(put()), 1));
    return put();
  }
});

const checks = [
  ['async_pread_entry', 10203040],
  ['sync_pread_entry', 10203040],
  ['yield_entry', 1],
  ['wait_entry', 7]
];
for (const [name, expectedResult] of checks) {
  const result = await module.ccall(name, 'number', [], [], { async: true });
  if (result !== expectedResult) throw new Error(`${name} returned ${result}, expected ${expectedResult}`);
}
process.stdout.write('Asyncify filesystem + frame-yield + wait bridges: PASS\\n');
