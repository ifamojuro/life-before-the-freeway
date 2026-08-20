import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cx } from "../lib/util";

type ToastFn = (msg: string, kind?: "ok" | "err") => void;
const Ctx = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback<ToastFn>((msg, kind = "ok") => {
    setT({ msg, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(null), 3200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {t && <div className={cx("toast", t.kind === "err" && "err")} role="status">{t.msg}</div>}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
