/**
 * Device / layout detection.
 *
 * The site is desktop-first and fully responsive, but several flows have a
 * dedicated mobile design (home map + chat sheet, stepped contributor flow).
 * `layout` is "mobile" when a mobile browser is detected by user agent, OR the
 * viewport is phone-sized; otherwise "desktop". `?layout=mobile|desktop` forces
 * a layout for testing and is remembered for the session.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Layout = "desktop" | "mobile";
const MOBILE_MAX = 767;
const OVERRIDE_KEY = "lbtf.layout";

export function detectMobileUA(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPod|Mobile|webOS|BlackBerry|Opera Mini|IEMobile|Windows Phone/i.test(ua)) return true;
  // iPadOS 13+ reports as Macintosh; treat touch Macs as tablets (phone-width check still applies)
  if (/iPad/i.test(ua)) return true;
  return false;
}

function readOverride(): Layout | null {
  try {
    const q = new URLSearchParams(window.location.search).get("layout");
    if (q === "mobile" || q === "desktop") {
      sessionStorage.setItem(OVERRIDE_KEY, q);
      return q;
    }
    const s = sessionStorage.getItem(OVERRIDE_KEY);
    return s === "mobile" || s === "desktop" ? s : null;
  } catch {
    return null;
  }
}

interface DeviceState {
  layout: Layout;
  isMobileUA: boolean;
  isNarrow: boolean;
  isTouch: boolean;
}

const DeviceContext = createContext<DeviceState>({ layout: "desktop", isMobileUA: false, isNarrow: false, isTouch: false });

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [isNarrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth <= MOBILE_MAX);
  const isMobileUA = useMemo(detectMobileUA, []);
  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  const override = useMemo(readOverride, []);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const layout: Layout = override ?? (isMobileUA || isNarrow ? "mobile" : "desktop");

  useEffect(() => {
    document.documentElement.dataset.layout = layout;
  }, [layout]);

  const value = useMemo(() => ({ layout, isMobileUA, isNarrow, isTouch }), [layout, isMobileUA, isNarrow, isTouch]);
  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice() {
  return useContext(DeviceContext);
}
