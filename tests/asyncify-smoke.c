#include <emscripten.h>
#include <stdint.h>

/* Keep this bridge identical to host_shims_fs.c's Asyncify branch. */
EM_ASYNC_JS(int, isaac_fs_lazy_pread_js,
            (const char *src, uint8_t *dst, uint32_t off, uint32_t len), {
    if (typeof Module.isaacLazyPread !== "function") return -1;
    var s = "";
    for (var i = src; HEAPU8[i]; i++) s += String.fromCharCode(HEAPU8[i]);
    var n = Module.isaacLazyPread(s, dst, off, len);
    /* Asyncify must await the import itself, not return a bare Promise. */
    if (n && typeof n.then === "function") n = await n;
    return typeof n === "number" ? n : -1;
});

/* These two test bridges preserve the production signatures and async shape:
 * host_shims_win.c's frame-yield and render-gate wait imports. */
EM_ASYNC_JS(int, isaac_yield_js, (double work), {
    await Promise.resolve();
    return work > 0 ? 1 : 0;
});

EM_ASYNC_JS(int, isaac_wait_js, (double ms, int mode), {
    await new Promise(function (resolve) { setTimeout(resolve, 1); });
    return (int)ms + mode;
});

static int check_read(const char *name) {
    uint8_t dst[4] = {0, 0, 0, 0};
    int n = isaac_fs_lazy_pread_js(name, dst, 17, sizeof(dst));
    if (n != 4) return -1;
    return (int)dst[0] * 1000000 + (int)dst[1] * 10000
         + (int)dst[2] * 100 + (int)dst[3];
}

/* Promise path, like a reader Worker miss. */
int async_pread_entry(void) { return check_read("asset"); }

/* Synchronous path, like a cached window. */
int sync_pread_entry(void) { return check_read("sync"); }

int yield_entry(void) { return isaac_yield_js(1.0); }
int wait_entry(void) { return isaac_wait_js(5.0, 2); }
