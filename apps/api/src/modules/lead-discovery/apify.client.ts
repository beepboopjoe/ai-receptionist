// ============================================================
// Apify REST wrapper — Phase 12.7.
//
// Thin client around the three Apify endpoints we need:
//   POST /v2/acts/{actorId}/runs                  — start a run
//   GET  /v2/actor-runs/{runId}                   — poll status
//   GET  /v2/actor-runs/{runId}/dataset/items     — fetch results
//
// All calls authenticate via Bearer token (config.APIFY_API_TOKEN).
// The actor we use is compass~crawler-google-places — Apify uses
// `~` to separate username/actorName in URL form. Internally
// they normalize to camelCase IDs too.
// ============================================================
import { config } from '../../config.js';
import { IntegrationError } from '../../lib/errors.js';
import pino from 'pino';

const logger = pino({ name: 'apify-client' });
const APIFY_BASE = 'https://api.apify.com/v2';

export type ApifyRunStatus =
  | 'READY'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'ABORTED'
  | 'TIMING_OUT'
  | 'TIMED_OUT'
  | 'ABORTING';

export interface ApifyRunSummary {
  id: string;
  status: ApifyRunStatus;
  startedAt: string;
  finishedAt?: string;
  defaultDatasetId: string;
  /** Apify-billed compute units, used for our margin tracking. */
  usageTotalUsd?: number;
}

/** Shape of a single record from compass~crawler-google-places. */
export interface GoogleMapsRecord {
  title?: string;
  phone?: string;
  phoneUnformatted?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  website?: string;
  totalScore?: number; // rating 1-5
  reviewsCount?: number;
  categoryName?: string;
  location?: { lat: number; lng: number };
  url?: string;
}

function requireToken(): string {
  if (!config.APIFY_API_TOKEN) {
    throw new IntegrationError('apify', 'APIFY_API_TOKEN is not configured');
  }
  return config.APIFY_API_TOKEN;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${APIFY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireToken()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new IntegrationError('apify', `${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/**
 * Start an Apify actor run. Returns immediately with the run ID;
 * the actual scrape happens asynchronously and is polled via getRunStatus.
 */
export async function startRun(
  actorId: string,
  input: Record<string, unknown>
): Promise<ApifyRunSummary> {
  // Apify accepts `actorId` in two forms: bare ID or username~actorName.
  const encoded = encodeURIComponent(actorId);
  const result = await request<{ data: ApifyRunSummary }>(`/acts/${encoded}/runs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  logger.info({ runId: result.data.id, actorId }, 'Apify run started');
  return result.data;
}

export async function getRunStatus(runId: string): Promise<ApifyRunSummary> {
  const result = await request<{ data: ApifyRunSummary }>(`/actor-runs/${runId}`);
  return result.data;
}

export async function getRunResults<T = GoogleMapsRecord>(
  datasetId: string,
  options: { limit?: number } = {}
): Promise<T[]> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  params.set('clean', '1'); // strip Apify-internal metadata
  const path = `/datasets/${datasetId}/items?${params.toString()}`;
  return request<T[]>(path);
}

/** Returns true once the run can no longer transition state. */
export function isRunSettled(status: ApifyRunStatus): boolean {
  return ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED_OUT'].includes(status);
}
