import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const wasmModulePath = process.argv[2];
if (!wasmModulePath) throw new Error('Pass the generated Asyncify module path');

let module;
const expected = [10, 20, 30, 40];
module = await (await import(pathToFileURL(resolve(wasmModulePath)).href)).default({
  isaacLazyPread(src, dst, off, len) {
    if (off !== 17 || len !== 4) throw new Error(`unexpected read window: ${src}@${off}+${len}`);
    const bytes = src === 'asset' ? expected : src === 'sync' ? expected : null;
    if (!bytes) throw new Error(`unexpected source: ${src}`);
    const put = () => {
      module.HEAPU8.set(bytes.slice(0, len), dst);
      return len;
    };
    if (src === 'asset') return new Promise((resolve) => setTimeout(() => resolve(put()), 1));
    return put();
  }
});

for (const name of ['async_pread_entry', 'sync_pread_entry']) {
  const result = await module.ccall(name, 'number', [], [], { async: true });
  if (result !== 10203040) throw new Error(`${name} returned ${result}, expected 10203040`);
}
process.stdout.write('Asyncify lazy archive read (Promise + sync cache hit): PASS\n');
