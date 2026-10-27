// What's new (DEC-0075): the personalization engine's ranked feed (components/WhatsNew,
// DEC-0068), drawn inside the Home widget frame. Its lines describe past test results, each says
// why it is there, and none is advice. With personalization off the feed is newest first.
import { WhatsNew as Feed } from "../../components/WhatsNew";
import type { WidgetProps } from "../Home";

export default function WhatsNew({ report }: WidgetProps) {
  return <div className="wnew-embed"><Feed report={report} /></div>;
}
