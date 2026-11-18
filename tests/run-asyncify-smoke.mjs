import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const wasmModulePath = process.argv[2];
if (!wasmModulePath) throw new Error('Pass the generated Asyncify module path');

const { default: createModule } = await import(pathToFileURL(resolve(wasmModulePath)).href);
const module = await createModule();
const result = await module.ccall("async_probe_entry", "number", [], [], { async: true });
if (result !== 42) throw new Error(`Asyncify bridge returned ${result}, expected 42`);
process.stdout.write('Asyncify Promise bridge: PASS\n');
