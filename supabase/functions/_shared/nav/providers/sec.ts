import type { NavProvider, NavResult } from "../types.ts";

const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;
const THROTTLE_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const wait = BACKOFF_BASE_MS * Math.pow(2, attempt);
          console.warn(`[SEC] HTTP ${res.status} for ${url}, retrying in ${wait}ms…`);
          await delay(wait);
          continue;
        }
      }

      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err as Error;

      if (attempt < retries) {
        const wait = BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.warn(`[SEC] Network error for ${url}, retrying in ${wait}ms: ${lastError.message}`);
        await delay(wait);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`fetchWithRetry failed for ${url}`);
}

/**
 * SEC Thailand NAV Provider
 *
 * Uses two SEC APIs:
 * 1. Fund Factsheet API — resolves fund abbreviations (proj_abbr_name) to proj_id
 *    - GET /FundFactsheet/fund/amc → list AMCs (returns unique_id)
 *    - GET /FundFactsheet/fund/amc/{unique_id} → list funds (returns proj_id, proj_abbr_name)
 *
 * 2. Fund Daily Info API — fetches daily NAV by proj_id
 *    - GET /FundDailyInfo/{proj_id}/dailynav/{YYYY-MM-DD} → { last_val, ... }
 *
 * Both APIs use the same Ocp-Apim-Subscription-Key header but may require
 * separate subscriptions on the SEC portal.
 */
export class SecThNavProvider implements NavProvider {
  private factsApiKey: string;
  private dailyApiKey: string;

  // Cache: proj_abbr_name (uppercase) → proj_id
  private projIdCache: Map<string, string> | null = null;

  constructor() {
    // Fund Factsheet API key (used for fund lookup)
    const factsKey = Deno.env.get("SEC_API_KEY") ?? "";
    if (!factsKey) {
      throw new Error(
        "SEC_API_KEY is not configured. Set the SEC_API_KEY secret to enable the SEC Thailand NAV provider.",
      );
    }
    this.factsApiKey = factsKey;

    // Fund Daily Info API key — defaults to same key if not set separately
    this.dailyApiKey = Deno.env.get("SEC_DAILY_API_KEY") ?? factsKey;
  }

  /**
   * Build the proj_abbr_name → proj_id mapping by crawling AMCs.
   * Cached for the lifetime of the function invocation.
   */
  private async buildProjIdMap(): Promise<Map<string, string>> {
    if (this.projIdCache) return this.projIdCache;

    const headers = {
      "Ocp-Apim-Subscription-Key": this.factsApiKey,
      Accept: "application/json",
    };

    // Step 1: List all AMCs
    const amcRes = await fetchWithRetry(
      "https://api.sec.or.th/FundFactsheet/fund/amc",
      headers,
    );

    if (!amcRes.ok) {
      const body = await amcRes.text();
      throw new Error(`[SEC] Failed to list AMCs: HTTP ${amcRes.status} — ${body.substring(0, 200)}`);
    }

    const amcs = await amcRes.json() as Array<{ unique_id: string }>;
    if (!Array.isArray(amcs) || amcs.length === 0) {
      throw new Error("[SEC] AMC list is empty");
    }

    const map = new Map<string, string>();

    // Step 2: For each AMC, list funds
    for (let i = 0; i < amcs.length; i++) {
      const amc = amcs[i];
      if (!amc.unique_id) continue;

      try {
        const fundRes = await fetchWithRetry(
          `https://api.sec.or.th/FundFactsheet/fund/amc/${amc.unique_id}`,
          headers,
        );

        if (!fundRes.ok) {
          console.warn(`[SEC] Failed to list funds for AMC ${amc.unique_id}: HTTP ${fundRes.status}`);
          await fundRes.text(); // consume body
          continue;
        }

        const funds = await fundRes.json() as Array<{
          proj_id: string;
          proj_abbr_name: string;
        }>;

        if (Array.isArray(funds)) {
          for (const fund of funds) {
            if (fund.proj_abbr_name && fund.proj_id) {
              map.set(fund.proj_abbr_name.toUpperCase(), String(fund.proj_id));
            }
          }
        }
      } catch (err) {
        console.warn(`[SEC] Error listing funds for AMC ${amc.unique_id}:`, (err as Error).message);
      }

      // Throttle between AMC requests
      if (i < amcs.length - 1) {
        await delay(THROTTLE_DELAY_MS);
      }
    }

    console.log(`[SEC] Built proj_id map with ${map.size} funds`);
    this.projIdCache = map;
    return map;
  }

  /**
   * Resolve a fund code to a SEC proj_id.
   * Tries exact match first, then case-insensitive partial match.
   */
  private async resolveProjId(fundCode: string): Promise<string | null> {
    const map = await this.buildProjIdMap();
    const upper = fundCode.toUpperCase();

    // Exact match
    if (map.has(upper)) return map.get(upper)!;

    // Try without hyphens/spaces
    const normalized = upper.replace(/[-\s]/g, "");
    for (const [key, projId] of map) {
      if (key.replace(/[-\s]/g, "") === normalized) return projId;
    }

    return null;
  }

  async fetchLatestNavForFund(fundCode: string): Promise<NavResult | null> {
    try {
      const projId = await this.resolveProjId(fundCode);
      if (!projId) {
        console.warn(`[SEC] Could not resolve proj_id for fund: ${fundCode}`);
        return null;
      }

      // Try today and previous days (in case of holidays/weekends)
      const today = new Date();
      for (let daysBack = 0; daysBack < 5; daysBack++) {
        const date = new Date(today);
        date.setDate(date.getDate() - daysBack);
        const dateStr = date.toISOString().substring(0, 10);

        const url = `https://api.sec.or.th/FundDailyInfo/${projId}/dailynav/${dateStr}`;
        const res = await fetchWithRetry(url, {
          "Ocp-Apim-Subscription-Key": this.dailyApiKey,
          Accept: "application/json",
        });

        // 204 = no data for this date (holiday/weekend)
        if (res.status === 204) {
          await res.text(); // consume
          await delay(THROTTLE_DELAY_MS);
          continue;
        }

        if (!res.ok) {
          const body = await res.text();
          console.warn(`[SEC] HTTP ${res.status} for ${fundCode} on ${dateStr}: ${body.substring(0, 200)}`);
          // 401 likely means Fund Daily Info API not subscribed
          if (res.status === 401) {
            console.error(`[SEC] 401 on FundDailyInfo — ensure your SEC API key is subscribed to "Fund Daily Info" product`);
            return null;
          }
          await delay(THROTTLE_DELAY_MS);
          continue;
        }

        const data = await res.json();
        const navPerUnit = parseFloat(data?.last_val);

        if (isNaN(navPerUnit) || navPerUnit <= 0) {
          console.warn(`[SEC] Invalid last_val for ${fundCode} on ${dateStr}:`, data?.last_val);
          continue;
        }

        return {
          fundCode,
          navDate: dateStr,
          navPerUnit,
          source: "sec_th",
        };
      }

      console.warn(`[SEC] No NAV data found for ${fundCode} in last 5 days`);
      return null;
    } catch (err) {
      console.error(`[SEC] Error fetching ${fundCode}:`, err);
      return null;
    }
  }

  async fetchLatestNavForFunds(fundCodes: string[]): Promise<NavResult[]> {
    // Pre-build the proj_id map once for all funds
    try {
      await this.buildProjIdMap();
    } catch (err) {
      console.error(`[SEC] Failed to build proj_id map:`, (err as Error).message);
      throw err;
    }

    const results: NavResult[] = [];
    for (let i = 0; i < fundCodes.length; i++) {
      const result = await this.fetchLatestNavForFund(fundCodes[i]);
      if (result) results.push(result);

      // Throttle between requests (skip after last)
      if (i < fundCodes.length - 1) {
        await delay(THROTTLE_DELAY_MS);
      }
    }
    return results;
  }
}
