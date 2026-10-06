import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppState } from '../types';
import { loadState, saveState } from './storage';

interface Store {
  state: AppState;
  /** draft(깊은 복사본)를 직접 수정하는 방식으로 상태를 바꾼다. */
  update: (fn: (draft: AppState) => void) => void;
  replace: (next: AppState) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => saveState(state), [state]);

  const update = useCallback((fn: (draft: AppState) => void) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });
  }, []);

  return <StoreContext.Provider value={{ state, update, replace: setState }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('StoreProvider가 필요합니다.');
  return ctx;
}
