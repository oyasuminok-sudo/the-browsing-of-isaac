#include <emscripten.h>
#include <stdint.h>

/* Keep this bridge identical to host_shims_fs.c's Asyncify branch. */
EM_ASYNC_JS(int, isaac_fs_lazy_pread_js,
            (const char *src, uint8_t *dst, uint32_t off, uint32_t len), {
    if (typeof Module.isaacLazyPread !== "function") return -1;
    var s = "";
    for (var i = src; HEAPU8[i]; i++) s += String.fromCharCode(HEAPU8[i]);
    var n = Module.isaacLazyPread(s, dst, off, len);
    if (n && typeof n.then === "function") n = await n;
    return typeof n === "number" ? n : -1;
});

static int check_read(const char *name) {
    uint8_t dst[4] = {0, 0, 0, 0};
    int n = isaac_fs_lazy_pread_js(name, dst, 17, sizeof(dst));
    if (n != 4) return -1;
    return (int)dst[0] * 1000000 + (int)dst[1] * 10000
         + (int)dst[2] * 100 + (int)dst[3];
}

/* This path makes isaacLazyPread return a Promise, like a reader Worker miss. */
int async_pread_entry(void) {
    return check_read("asset");
}

/* This path returns bytes synchronously, like a cache hit. */
int sync_pread_entry(void) {
    return check_read("sync");
}
