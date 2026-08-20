import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useDevice } from "../../lib/device";
import type { EraKey, LocationPin } from "../../lib/types";
import { HomeDesktop } from "./HomeDesktop";
import { HomeMobile } from "./HomeMobile";

const ERA_KEY = "lbtf.era";

export function useHomeData() {
  const [era, setEraState] = useState<EraKey>(() => {
    const s = sessionStorage.getItem(ERA_KEY);
    return s === "1950" || s === "1965" || s === "1985" ? s : "1965";
  });
  const [pins, setPins] = useState<LocationPin[]>([]);
  const [allPins, setAllPins] = useState<LocationPin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const setEra = (e: EraKey) => { setEraState(e); sessionStorage.setItem(ERA_KEY, e); };

  useEffect(() => {
    api.pins().then(setAllPins).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    api.pins(era).then(setPins).catch((e) => setError(e.message));
  }, [era]);

  return { era, setEra, pins, allPins, error };
}

export default function HomePage() {
  const { layout } = useDevice();
  const data = useHomeData();
  return layout === "mobile" ? <HomeMobile {...data} /> : <HomeDesktop {...data} />;
}
