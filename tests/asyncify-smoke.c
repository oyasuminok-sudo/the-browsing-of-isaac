#include <emscripten.h>

EM_ASYNC_JS(int, async_probe, (void), {
    await new Promise((resolve) => setTimeout(resolve, 1));
    return 42;
});

int async_probe_entry(void) {
    return async_probe();
}
