// Pairs in Parity Workbench (DEC-0043): the same results as the research Pairs page, read
// only. The chosen recipe and pair live in the address (#/pairs?recipe=...&pair=...).
import { PairsReport } from "../components/pairs/PairsReport";
import { loadPairs } from "../lib/pairs";
import { Button, useResource } from "../ui";

export function PairsView() {
  const { data, error, refresh } = useResource("pairs", loadPairs, { maxAge: 5 * 60_000 });
  return (
    <div className="lb-view lb-scroll lb-pairs">
      {error ? (
        <div className="lb-msg" role="alert">
          <span>No pairs results yet. {error} <Button size="xs" onClick={refresh}>Try again</Button></span>
        </div>
      ) : !data ? <div className="lb-msg lb-loading" aria-busy="true">Loading the pairs results</div>
        : <PairsReport doc={data} heading={2} />}
    </div>
  );
}
