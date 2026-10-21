// A small stroke icon set, 16px, drawn on a 16 grid. currentColor throughout.
import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  home: <path d="M2.5 7 8 2.5 13.5 7v6a.5.5 0 0 1-.5.5H10v-4H6v4H3a.5.5 0 0 1-.5-.5z" />,
  chart: <path d="M2 13.5h12M3.5 11 6.5 7l2.5 2.5L13 4.5" />,
  list: <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />,
  compare: <path d="M4 2.5v11M12 2.5v11M4 5.5h4M8 10.5h4" />,
  flask: <path d="M6 2.5h4M6.5 2.5v4L3 12.5a1 1 0 0 0 .9 1.5h8.2a1 1 0 0 0 .9-1.5L9.5 6.5v-4M4.8 9.5h6.4" />,
  compass: <><circle cx="8" cy="8" r="5.5" /><path d="m10.5 5.5-1.5 3.5-3.5 1.5 1.5-3.5z" /></>,
  signal: <path d="M3 13V10M6.3 13V7.5M9.7 13V5M13 13V2.5" />,
  catalog: <path d="M3 2.5h7.5L13 5v8.5H3zM10.5 2.5V5H13M5.5 8h5M5.5 10.5h5" />,
  ledger: <path d="M4 2.5h8.5v11H4a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 4 2.5zM5.5 5.5h4.5M5.5 8h4.5" />,
  database: <><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8" /></>,
  pulse: <path d="M1.5 8.5h3l1.5-3 2.5 6 1.5-3h4.5" />,
  book: <path d="M8 4.2C6.8 3.2 4.8 2.8 2.5 3v9.5c2.3-.2 4.3.2 5.5 1.2 1.2-1 3.2-1.4 5.5-1.2V3c-2.3-.2-4.3.2-5.5 1.2zM8 4.2v9.5" />,
  cap: <path d="M1.5 6 8 3l6.5 3L8 9zM4 7.2v3.3c1 .9 2.5 1.5 4 1.5s3-.6 4-1.5V7.2M14.5 6v3.5" />,
  quote: <path d="M3 9.5h3v3.5H3V9q0-3.5 3-5M10 9.5h3v3.5h-3V9q0-3.5 3-5" />,
  gear: <><circle cx="8" cy="8" r="2" /><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2" /></>,
  search: <><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></>,
  bookmark: <path d="M4 2.5h8v11L8 10.5l-4 3z" />,
  chevronLeft: <path d="M10 3.5 5.5 8l4.5 4.5" />,
  chevronDown: <path d="M4 6l4 4 4-4" />,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  arrowUpRight: <path d="M5 11 11 5M6 5h5v5" />,
  arrowDownRight: <path d="M5 5l6 6M11 6v5H6" />,
  graph: <path d="M2 12.5 6 8l3 2.5 5-6" />,
  table: <path d="M2.5 3h11v10h-11zM2.5 6.5h11M2.5 10h11M7 3v10" />,
  user: <><circle cx="8" cy="5.5" r="2.7" /><path d="M2.8 13.5c.8-2.4 2.8-3.7 5.2-3.7s4.4 1.3 5.2 3.7" /></>,
  moon: <path d="M12.8 9.8A5.3 5.3 0 0 1 6.2 3.2a5.3 5.3 0 1 0 6.6 6.6z" />,
  keyboard: <path d="M1.5 4.5h13v7h-13zM4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 9.5h6" />,
  team: <><circle cx="6" cy="6" r="2.2" /><circle cx="11.2" cy="6.5" r="1.7" /><path d="M2 13c.6-2 2.2-3.2 4-3.2s3.4 1.2 4 3.2M10.5 9.8c1.6 0 2.9 1 3.5 2.7" /></>,
  info: <><circle cx="8" cy="8" r="5.8" /><path d="M8 7.2v3.8M8 5h.01" /></>,
  eyeOff: <path d="M2 2l12 12M6.6 6.7A2 2 0 0 0 9.3 9.4M4.3 4.4C2.9 5.4 2 6.8 1.5 8c1 2.4 3.6 4.5 6.5 4.5 1.3 0 2.5-.4 3.5-1M7 3.6c.3 0 .7-.1 1-.1 2.9 0 5.5 2.1 6.5 4.5-.3.8-.8 1.6-1.4 2.3" />,
  check: <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />,
  checkCircle: <><circle cx="8" cy="8" r="6" /><path d="M5.5 8.2 7.2 9.9 10.5 6.3" /></>,
  filter: <path d="M2.5 4h11M4.5 8h7M6.5 12h3" />,
  calendar: <path d="M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3" />,
  sort: <path d="M5 3v10M2.8 10.8 5 13l2.2-2.2M11 13V3M8.8 5.2 11 3l2.2 2.2" />,
  plus: <path d="M8 3v10M3 8h10" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  download: <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2M3 13.5h10" />,
  dots: <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" />,
  sparkle: <path d="M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8 6.7 6.7z" />,
  palette: <><circle cx="8" cy="8" r="5.8" /><path d="M5.2 7.2h.01M7.2 5h.01M10.2 5.6h.01M8.5 11c0-1 .8-1.7 1.8-1.7H13" /></>,
  external: <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M11.5 9.5v4h-9v-9h4" />,
};

export function Icon({ name, size = 16, className }: { name: keyof typeof paths | string; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className ?? ""}`} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name] ?? null}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(paths);
