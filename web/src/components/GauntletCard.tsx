import { Term } from "../pages/Learn";
import type { Gauntlet, GauntletTest } from "../lib/types";
import { Card, Pass } from "../ui/layout";

const GROUPS: { key: GauntletTest["group"]; title: string; help: string }[] = [
  { key: "beat", title: "A. Does it beat the S&P 500?", help: "All six must pass." },
  { key: "real", title: "B. Is there anything real here, or is it luck?", help: "A strategy can fail A and still pass these." },
];

export function GauntletCard({ gauntlet }: { gauntlet: Gauntlet }) {
  return (
    <Card
      title={`The gauntlet: ${gauntlet.passed} of ${gauntlet.total} tests passed`}
      help={<>Eleven tests fixed before we saw any results. <a href="#/learn/out-of-sample">Why these tests?</a></>}
    >
      <p className={`verdict ${gauntlet.beats_sp500 ? "good" : ""}`}>{gauntlet.verdict}</p>
      {GROUPS.map((g) => (
        <div key={g.key} className="gauntlet-group">
          <h3>{g.title} <span className="muted small">{g.help}</span></h3>
          <div className="table-wrap">
            <table className="gauntlet">
              <thead>
                <tr><th>Test</th><th>What it asks</th><th>Result</th><th>Bar</th><th></th></tr>
              </thead>
              <tbody>
                {gauntlet.tests.filter((t) => t.group === g.key).map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.id}</strong> {t.name}</td>
                    <td className="wrap">{t.plain}</td>
                    <td className="wrap">{t.value}</td>
                    <td className="wrap muted">{t.bar}</td>
                    <td><Pass ok={t.passed} label={t.bar} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="muted small">
        Trials behind this result, counting the gauntlet's own variants: {gauntlet.trials_including_gauntlet}. More
        trials make luck more likely; see <Term id="data-snooping">data snooping</Term> and{" "}
        <Term id="deflated-sharpe-ratio">deflated Sharpe ratio</Term>.
      </p>
    </Card>
  );
}
