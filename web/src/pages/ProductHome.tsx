// Product home (DEC-0075): a greeting by first name, the Ask box and the person's own grid of
// widgets (src/home). Every strategy number shown comes from the research side's tests, with
// its verdict; the product never ranks on return alone (DEC-0015).
import type { Report } from "../lib/types";
import { Home } from "../home/Home";

export function ProductHome({ report }: { report: Report; email?: string | null }) {
  return <Home report={report} />;
}
