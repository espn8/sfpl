type AnalyticsEventParams = Record<string, string | number | boolean | null | undefined>;

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
let initialized = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isProduction(): boolean {
  return import.meta.env.PROD;
}

function canTrack(): boolean {
  return isProduction() && Boolean(measurementId);
}

export function initAnalytics(): void {
  if (!canTrack() || initialized) {
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
  initialized = true;
}

export function trackPageView(path: string): void {
  if (!canTrack() || !window.gtag || !measurementId) {
    return;
  }

  window.gtag("event", "page_view", {
    page_location: window.location.href,
    page_path: path,
    send_to: measurementId,
  });
}

export function trackEvent(name: string, params?: AnalyticsEventParams): void {
  if (!canTrack() || !window.gtag || !measurementId) {
    return;
  }

  window.gtag("event", name, {
    ...params,
    send_to: measurementId,
  });
}
