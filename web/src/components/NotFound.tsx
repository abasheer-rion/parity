// The "not found" view every Parity app shows for an address it does not know (DEC-0055):
// an unknown hash route in the product, research, Terminal, Trade, Academy and Workbench
// apps, and a Verify badge link with no badge. Plain words, a Back and a Home action, and
// room for one more (such as Search). The static page for unknown paths is web/404.html.
import type { ReactNode } from "react";
import { Button } from "../ui/buttons";
import "./not-found.css";

export interface NotFoundProps {
  /** The heading. */
  title?: string;
  /** The line under the heading. */
  body?: ReactNode;
  /** The address that was asked for, shown so a typo is easy to spot. */
  address?: string;
  /** Where Home goes, and what it says. */
  home?: string;
  homeLabel?: string;
  /** Back goes to the previous page; with no previous page it goes Home. */
  onBack?: () => void;
  /** More actions after Back and Home. */
  children?: ReactNode;
  /** h1 when the view is the page's main heading (the default), h2 under an app header that has one. */
  heading?: "h1" | "h2";
}

/** Back to the previous page in this tab, or Home when this tab has no history. */
export function goBackOr(home: string): void {
  if (window.history.length > 1) window.history.back();
  else window.location.assign(home);
}

export function NotFound({
  title = "This page does not exist",
  body = "There is nothing at this address. The link may be mistyped, or the page may have moved.",
  address,
  home = "#/",
  homeLabel = "Home",
  onBack,
  children,
  heading = "h1",
}: NotFoundProps) {
  const H = heading;
  return (
    <section className="nf-view" aria-labelledby="nf-view-h" data-not-found>
      <img className="nf-view-mark" src="/brand/2026-10-21-starburst/parity-mark.svg" width={40} height={40} alt="" />
      <H id="nf-view-h" className="nf-view-h">{title}</H>
      <p className="nf-view-p">{body}</p>
      {address && <p className="nf-view-addr"><span className="sr-only">Address: </span><code>{address}</code></p>}
      <div className="nf-view-acts">
        <Button variant="secondary" icon="chevronLeft" onClick={onBack ?? (() => goBackOr(home))}>Back</Button>
        <Button variant="primary" href={home}>{homeLabel}</Button>
        {children}
      </div>
    </section>
  );
}
