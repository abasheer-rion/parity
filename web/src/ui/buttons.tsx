// Buttons. One primary per view (white, DEC-0058); everything else is quiet and sits
// close to the surface tone. A button with `href` renders a link. Variants: primary,
// secondary, ghost (no fill until hover), danger; "tertiary" is the older name for ghost
// and "outline" a raised floating button.
import type React from "react";
import type { ReactNode } from "react";
import { Icon } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "tertiary" | "outline" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

interface Common { variant?: ButtonVariant; size?: ButtonSize; icon?: string; iconRight?: string; full?: boolean; loading?: boolean; className?: string; children?: ReactNode; title?: string }

type AriaProps = { [k: `aria-${string}`]: string | number | boolean | undefined };

export function Button({ variant = "secondary", size = "md", icon, iconRight, full, loading, pressed, className = "", children, href, onClick, disabled, type = "button", title, ...rest }:
  Common & AriaProps & { href?: string; onClick?: (e: React.MouseEvent) => void; disabled?: boolean; type?: "button" | "submit"; target?: string; rel?: string; pressed?: boolean }) {
  const cls = `ui-btn ui-btn-${variant === "ghost" ? "tertiary" : variant} ui-btn-${size} ${full ? "ui-btn-full" : ""} ${loading ? "is-loading" : ""} ${pressed ? "on" : ""} ${className}`;
  // While loading, the label stays in place (invisible) and a spinner sits over it, so
  // the button keeps its exact width and nothing beside it moves.
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === "sm" || size === "xs" ? 13 : 14} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === "sm" || size === "xs" ? 13 : 14} />}
      {loading && <span className="ui-spinner" aria-hidden />}
    </>
  );
  if (href) return <a className={cls} href={href} title={title} {...rest} aria-disabled={disabled || undefined}>{inner}</a>;
  return <button type={type} className={cls} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} aria-pressed={pressed} title={title} {...rest}>{inner}</button>;
}

/** A round icon-only button, like Mercury's bookmark and card actions. Always needs a label. */
const ICON_BTN = { xs: 24, sm: 28, md: 32, lg: 40 } as const;

/** A round icon-only button. Always needs a label: it becomes the tooltip and the name screen readers hear. */
export function IconButton({ icon, label, onClick, href, active, size = "md", variant = "soft", disabled, className = "", ...rest }:
  { icon: string; label: string; onClick?: () => void; href?: string; active?: boolean; size?: number | "xs" | "sm" | "md" | "lg"; variant?: "soft" | "plain"; disabled?: boolean; className?: string; "data-doc"?: string }) {
  const cls = `ui-iconbtn ui-iconbtn-${variant} ${active ? "on" : ""} ${className}`;
  const px = typeof size === "number" ? size : ICON_BTN[size];
  const style = { width: px, height: px };
  const i = <Icon name={icon} size={Math.round(px * 0.44)} />;
  return href
    ? <a className={cls} style={style} href={href} aria-label={label} title={label} {...rest}>{i}</a>
    : <button type="button" className={cls} style={style} onClick={onClick} aria-label={label} title={label} aria-pressed={active} disabled={disabled} {...rest}>{i}</button>;
}

/** A button that reads as a link: for small actions inside text or a table row (Unfollow, Show all). */
export function TextButton({ children, onClick, tone = "default", disabled, title }:
  { children: ReactNode; onClick: () => void; tone?: "default" | "muted" | "danger"; disabled?: boolean; title?: string }) {
  return <button type="button" className={`ui-linkbtn ui-linkbtn-${tone}`} onClick={onClick} disabled={disabled} title={title}>{children}</button>;
}

export function ButtonGroup({ children }: { children: ReactNode }) {
  return <div className="ui-btn-group">{children}</div>;
}
