// "Copy link" beside each page title (DEC-0038): copies the shortest link that reopens
// this view as it is now, filters and all (src/lib/deeplink.ts).
import { shareUrl } from "../lib/deeplink";
import { toast } from "../ui";
import { Icon } from "../ui/icons";

export async function copyLink(href: string = window.location.href): Promise<boolean> {
  const url = shareUrl(href);
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied. It opens this view as it is now.");
    return true;
  } catch {
    toast(`Copy this link: ${url}`, { ms: 8000 });
    return false;
  }
}

export function CopyLink() {
  return (
    <button type="button" className="round-btn" onClick={() => void copyLink()} aria-label="Copy link to this view" title="Copy link to this view">
      <Icon name="link" size={13} />
    </button>
  );
}
