"use client";

import { useEffect, useState } from "react";
import { getJson } from "./api";

type Params = Parameters<typeof getJson>[1];

/** Fetch JSON and keep showing the previous result while a new one loads (no skeleton flash). */
export function useApi<T>(path: string, params?: Params) {
  const key = JSON.stringify([path, params]);
  const [state, setState] = useState<{ key?: string; data?: T; error?: string }>({});

  useEffect(() => {
    const ctrl = new AbortController();
    getJson<T>(path, params, ctrl.signal)
      .then((data) => setState({ key, data }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState((s) => ({ ...s, key, error: e.message }));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data: state.data, error: state.error, loading: state.key !== key };
}
