"use client";

import React from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

export interface TurnstileProps {
  siteKey: string;
  onToken: (token: string | null) => void;
  /** Receives a reset function (tokens are single-use). */
  resetRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Cloudflare Turnstile widget, interaction-only appearance — invisible unless
 * the visitor needs to prove themselves.
 */
export function Turnstile({ siteKey, onToken, resetRef }: TurnstileProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const widgetId = React.useRef<string | null>(null);

  React.useEffect(() => {
    const render = () => {
      if (!ref.current || widgetId.current != null || !window.turnstile) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: "dark",
        appearance: "interaction-only",
        size: "flexible",
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
      if (resetRef) {
        resetRef.current = () => {
          if (widgetId.current != null) window.turnstile?.reset(widgetId.current);
          onToken(null);
        };
      }
    };
    if (window.turnstile) {
      render();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (existing) {
      existing.addEventListener("load", render);
      return () => existing.removeEventListener("load", render);
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.dataset.turnstile = "1";
    s.addEventListener("load", render);
    document.head.appendChild(s);
  }, [siteKey, onToken, resetRef]);

  return <div ref={ref} style={{ width: "100%" }} />;
}
