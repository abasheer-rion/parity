// parity-live: holds the LiveHub Durable Object class (DEC-0052). Browsers never reach this
// worker directly; the site's /live/* Pages Function forwards to the object by binding.
// The fetch handler only answers a health check.
export { LiveHub } from "./hub";

export default {
  async fetch(): Promise<Response> {
    return new Response("parity-live: reached through the site's /live/ address only.", { status: 404 });
  },
};
