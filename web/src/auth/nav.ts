// Page changes, in one place so the tests can watch them instead of navigating.

/** Go to another page. replace() keeps one-time links out of the back button. */
export function go(path: string) {
  window.location.replace(path);
}

/** Go to another page and keep the current one in the history. */
export function goPush(path: string) {
  window.location.assign(path);
}
