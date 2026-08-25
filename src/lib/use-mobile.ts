"use client";

import React from "react";

/** True below the breakpoint. SSR renders desktop; corrected on hydration. */
export function useIsMobile(breakpoint = 900): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [breakpoint],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(`(max-width:${breakpoint}px)`).matches,
    () => false,
  );
}
