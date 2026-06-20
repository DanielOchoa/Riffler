// Privacy-friendly analytics via Umami (cookieless — no consent banner needed).
// The tracker tag lives in index.html and exposes window.umami. These helpers
// no-op whenever it's absent — local dev, preview, or an ad-blocker — so call
// sites never have to guard. The tag's data-domains attribute also keeps
// non-production hosts from sending, so only the live site shows up.

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, string | number | boolean>) => void;
    };
  }
}

export function track(
  event: string,
  data?: Record<string, string | number | boolean>,
): void {
  window.umami?.track(event, data);
}
