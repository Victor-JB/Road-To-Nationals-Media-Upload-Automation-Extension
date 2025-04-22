// util/progress.js
// Simple throttle helper for progress events.
export function throttle(fn, delay = 200) {
  let last = 0;
  let pending = null;
  return (...args) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    } else {
      clearTimeout(pending);
      pending = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, delay - (now - last));
    }
  };
}
