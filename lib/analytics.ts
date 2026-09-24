import posthog from "posthog-js";
import { POSTHOG_PROXY_PATH, posthogUpstreams } from "@/lib/posthogProxy";

export const INTERNAL_STORAGE_KEY = "mindos_internal";

type CaptureValue = string | number | boolean;

let initialized = false;
let capturing = false;
let landingCaptured = false;

function isLocalhost() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function hasDevTierParam(params: URLSearchParams) {
  return params.has("devTier");
}

function readInternalFlag() {
  try {
    return window.localStorage.getItem(INTERNAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeInternalFlag() {
  try {
    window.localStorage.setItem(INTERNAL_STORAGE_KEY, "1");
  } catch {
    // Private mode can reject storage; the URL check still blocks this visit.
  }
}

const privacyOptions = {
  api_host: POSTHOG_PROXY_PATH,
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  disable_session_recording: true,
  capture_dead_clicks: false,
  capture_performance: false,
  enable_heatmaps: false,
  capture_exceptions: false,
  disable_surveys: true,
  rageclick: false,
  advanced_disable_feature_flags: true,
  person_profiles: "identified_only",
} as const;

function capture(event: string, properties?: Record<string, CaptureValue>) {
  if (!initialized || !capturing) return;
  if (posthog.has_opted_out_capturing()) return;
  posthog.capture(event, properties);
}

/**
 * Start PostHog only when a project key and host exist, and this browser is
 * not localhost, a devTier preview, or an opted-out internal device.
 * Never calls identify(); the SDK keeps its own anonymous distinct id.
 */
export function initAnalytics() {
  if (typeof window === "undefined" || initialized) return;

  const params = new URLSearchParams(window.location.search);
  const optOutVisit = params.get("internal") === "1";
  if (optOutVisit) writeInternalFlag();

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host || isLocalhost() || hasDevTierParam(params)) return;

  const uiHost = posthogUpstreams(host).ui;

  if (readInternalFlag() || optOutVisit) {
    if (!optOutVisit) return;
    posthog.init(key, {
      ...privacyOptions,
      ui_host: uiHost,
      opt_out_capturing_by_default: true,
    });
    posthog.opt_out_capturing();
    initialized = true;
    capturing = false;
    return;
  }

  posthog.init(key, {
    ...privacyOptions,
    ui_host: uiHost,
  });
  initialized = true;
  capturing = true;
}

/** Once per full page load. Survives React strict-mode remounts. */
export function captureLandingView() {
  initAnalytics();
  if (landingCaptured) return;
  landingCaptured = true;
  capture("landing_view");
}

export function captureBreathingStart() {
  capture("breathing_start");
}

export function captureBreathingComplete() {
  capture("breathing_complete");
}

export function captureTestStart(properties: {
  attempt_id: string;
  is_retest: boolean;
  did_complete_breathing: boolean;
  attempt_number: number;
}) {
  capture("test_start", properties);
}

export function captureTestComplete(properties: {
  attempt_id: string;
  tier_id: string;
  is_retest: boolean;
  did_complete_breathing: boolean;
  attempt_number: number;
  latency_ms: number;
  interference_ms: number;
  accuracy: number;
}) {
  capture("test_complete", properties);
}

export function captureCardSaved(properties: {
  attempt_id: string;
  tier_id: string;
  did_complete_breathing: boolean;
  method: "download" | "share";
}) {
  capture("card_saved", properties);
}
