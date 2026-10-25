// Buttons. One primary per view (white, DEC-0058); everything else is quiet and sits
// close to the surface tone. A button with `href` renders a link. Variants: primary,
// secondary, ghost (no fill until hover), danger; "tertiary" is the older name for ghost
// and "outline" a raised floating button.
import type { ReactNode } from "react";
import { Icon } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "tertiary" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface Common { variant?: ButtonVariant; size?: ButtonSize; icon?: string; iconRight?: string; full?: boolean; loading?: boolean; className?: string; children?: ReactNode; title?: string }

export function Button({ variant = "secondary", size = "md", icon, iconRight, full, loading, className = "", children, href, onClick, disabled, type = "button", title, ...rest }:
  Common & { href?: string; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; "aria-label"?: string; target?: string }) {
  const cls = `ui-btn ui-btn-${variant === "ghost" ? "tertiary" : variant} ui-btn-${size} ${full ? "ui-btn-full" : ""} ${loading ? "is-loading" : ""} ${className}`;
  // While loading, the label stays in place (invisible) and a spinner sits over it, so
  // the button keeps its exact width and nothing beside it moves.
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 14} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 13 : 14} />}
      {loading && <span className="ui-spinner" aria-hidden />}
    </>
  );
  if (href) return <a className={cls} href={href} title={title} {...rest} aria-disabled={disabled || undefined}>{inner}</a>;
  return <button type={type} className={cls} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} title={title} {...rest}>{inner}</button>;
}

/** A round icon-only button, like Mercury's bookmark and card actions. Always needs a label. */
const ICON_BTN = { sm: 28, md: 32, lg: 40 } as const;

export function IconButton({ icon, label, onClick, href, active, size = "md", variant = "soft" }:
  { icon: string; label: string; onClick?: () => void; href?: string; active?: boolean; size?: number | "sm" | "md" | "lg"; variant?: "soft" | "plain" }) {
  const cls = `ui-iconbtn ui-iconbtn-${variant} ${active ? "on" : ""}`;
  const px = typeof size === "number" ? size : ICON_BTN[size];
  const style = { width: px, height: px };
  const i = <Icon name={icon} size={Math.round(px * 0.44)} />;
  return href
    ? <a className={cls} style={style} href={href} aria-label={label} title={label}>{i}</a>
    : <button className={cls} style={style} onClick={onClick} aria-label={label} title={label} aria-pressed={active}>{i}</button>;
}

export function ButtonGroup({ children }: { children: ReactNode }) {
  return <div className="ui-btn-group">{children}</div>;
}
