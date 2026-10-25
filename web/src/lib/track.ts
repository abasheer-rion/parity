// Product analytics events. A stand-in with the same name and shape as the opt-in tracking
// being added on feat/product-analytics: until that lands, track() does nothing and sends
// nothing. Callers name the event and pass a few plain values, never personal data.

export type TrackProps = Record<string, string | number | boolean | null | undefined>;

/** Records one product event. Does nothing until the analytics module replaces this file. */
export function track(event: string, props: TrackProps = {}): void {
  void event;
  void props;
}
