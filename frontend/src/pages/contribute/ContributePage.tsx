import { useDevice } from "../../lib/device";
import { ContributeDesktop } from "./ContributeDesktop";
import { ContributeMobile } from "./ContributeMobile";
import { useContributeFlow } from "./useContributeFlow";

export default function ContributePage() {
  const { layout } = useDevice();
  const flow = useContributeFlow();
  return layout === "mobile" ? <ContributeMobile flow={flow} /> : <ContributeDesktop flow={flow} />;
}
