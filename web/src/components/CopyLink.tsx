// "Copy link" beside each page title (DEC-0038): copies the shortest link that reopens
// this view as it is now, filters and all (src/lib/deeplink.ts).
import { shareUrl } from "../lib/deeplink";
import { toast, IconButton } from "../ui";

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
    <IconButton icon="link" onClick={() => void copyLink()} label="Copy link to this view" />
  );
}
