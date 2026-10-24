// Which component shows each function, and the date a panel shows before its data says.
import type { TermCtx } from "../context";
import type { Leaf } from "../layout";
import { Empty } from "../tui";
import { ComparePanel } from "./Compare";
import { CurvePanel } from "./Curve";
import { DetailPanel } from "./Detail";
import { CotPanel, EcoPanel } from "./Groups";
import { HelpPanel, KpiPanel, NewsPanel } from "./Info";
import { HeatPanel, MonitorPanel, MoversPanel } from "./Monitor";
import { BotsPanel, SimPanel } from "./Sim";

export function PanelBody({ leaf }: { leaf: Leaf }) {
  switch (leaf.fn) {
    case "MON": return <MonitorPanel />;
    case "DES": return <DetailPanel />;
    case "HEAT": return <HeatPanel />;
    case "MOV": return <MoversPanel />;
    case "NEWS": return <NewsPanel />;
    case "KPI": return <KpiPanel />;
    case "HELP": return <HelpPanel />;
    case "CMP": return <ComparePanel />;
    case "CRV": return <CurvePanel />;
    case "COT": return <CotPanel />;
    case "ECO": return <EcoPanel />;
    case "BOTS": return <BotsPanel />;
    case "WMAP": case "CORR": case "SCEN": case "PATH": case "STRS": case "CRIS": case "RACE": case "CMDY": case "EQTY":
      return <SimPanel fn={leaf.fn} />;
    default: return <Empty title={`No function called ${leaf.fn}`}>Type HELP for the list.</Empty>;
  }
}

export function defaultAsOf(_fn: string, t: TermCtx): string | null {
  return t.index.status === "ok" ? t.index.data.data_through : null;
}
