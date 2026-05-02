"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buildTasteContextFromHistory,
  listConfirmedMealsForHistory,
  type TasteContextPayload,
} from "@/lib/db/meals";

type MesiTasteContextValue = {
  tasteContext: TasteContextPayload;
  refreshTaste: () => Promise<void>;
};

const MesiTasteContext = createContext<MesiTasteContextValue | null>(null);

export function MesiTasteProvider({ children }: { children: ReactNode }) {
  const [tasteContext, setTasteContext] = useState<TasteContextPayload>({
    liked_meal_names: [],
    disliked_meal_names: [],
  });

  const refreshTaste = useCallback(async () => {
    const rows = await listConfirmedMealsForHistory({ limit: 40 });
    setTasteContext(buildTasteContextFromHistory(rows, 10));
  }, []);

  useEffect(() => {
    void refreshTaste();
  }, [refreshTaste]);

  const value = useMemo(() => ({ tasteContext, refreshTaste }), [tasteContext, refreshTaste]);

  return <MesiTasteContext.Provider value={value}>{children}</MesiTasteContext.Provider>;
}

export function useMesiTaste(): MesiTasteContextValue {
  const v = useContext(MesiTasteContext);
  if (!v) {
    throw new Error("useMesiTaste must be used within MesiTasteProvider");
  }
  return v;
}
