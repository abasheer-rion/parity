// Pairs on the research side: statistical arbitrage recipes, each tested after costs, with
// the chosen pair's gap, hedge ratio, p-value and half-life over time. Reads /data/pairs.json
// (src/lib/pairs.ts). Derived numbers only; never a price.
import { Title } from "../components/Shell";
import { PairsReport } from "../components/pairs/PairsReport";
import { loadPairs } from "../lib/pairs";
import { ErrorState, PageSkeleton, useResource } from "../ui";

export function Pairs() {
  const { data, error, loading, refresh } = useResource("pairs", loadPairs, { maxAge: 5 * 60_000 });
  return (
    <div className="pr-page">
      <div className="page-head">
        <Title label="Pairs">Pairs</Title>
        <p>Pairs trading recipes, each tested after trading costs and borrow fees, with every try counted. Results only, never prices.</p>
      </div>
      {loading ? <PageSkeleton parts={["stats", "table", "chart"]} label="Loading the pairs results" />
        : error || !data ? <ErrorState title="No pairs results to show" onRetry={refresh}>{error ?? "The pairs results did not load."}</ErrorState>
        : <PairsReport doc={data} />}
    </div>
  );
}
