/**
 * Centralized SEC Open API client.
 *
 * All SEC Fund / Bond HTTP calls go through this module.
 * Base URL defaults to the v2 Open API gateway and can be overridden
 * via the SEC_API_BASE_URL environment variable for rollback safety.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://open-api.sec.or.th/v2";

const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;
const THROTTLE_DELAY_MS = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = MAX_RETRIES,
  logPrefix = "[SEC]",
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const wait = BACKOFF_BASE_MS * Math.pow(2, attempt);
          console.warn(`${logPrefix} HTTP ${res.status} for ${url}, retrying in ${wait}ms…`);
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
        console.warn(`${logPrefix} Network error for ${url}, retrying in ${wait}ms: ${lastError.message}`);
        await delay(wait);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`fetchWithRetry failed for ${url}`);
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

const NAV_FIELD_CANDIDATES = ["last_val", "nav", "net_asset"] as const;

/**
 * Parse the SEC Daily NAV API response.
 * Handles both object and array response shapes.
 */
export function parseDailyNavResponse(
  data: unknown,
  context?: string,
): number | null {
  if (data == null) {
    if (context) console.warn(`[SEC] Null response for ${context}`);
    return null;
  }

  let record: Record<string, unknown>;
  if (Array.isArray(data)) {
    if (data.length === 0) {
      if (context) console.warn(`[SEC] Empty array response for ${context}`);
      return null;
    }
    record = data[0] as Record<string, unknown>;
  } else if (typeof data === "object") {
    record = data as Record<string, unknown>;
  } else {
    if (context) console.warn(`[SEC] Unexpected response type (${typeof data}) for ${context}`);
    return null;
  }

  for (const field of NAV_FIELD_CANDIDATES) {
    const raw = record[field];
    if (raw !== undefined && raw !== null) {
      const val = parseFloat(String(raw));
      if (!isNaN(val) && val > 0) return val;
    }
  }

  if (context) {
    console.warn(`[SEC] Unexpected response shape for ${context}: keys=${Object.keys(record).join(",")}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// SEC API Client
// ---------------------------------------------------------------------------

export interface AmcRecord {
  unique_id: string;
  name_en?: string;
  name_th?: string;
}

export interface SecFundRecord {
  proj_id: string;
  proj_abbr_name: string;
  proj_name_en?: string;
  proj_name_th?: string;
}

export class SecApiClient {
  public readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("SEC API key is required");
    }
    this.apiKey = apiKey;
    this.baseUrl = Deno.env.get("SEC_API_BASE_URL") || DEFAULT_BASE_URL;
    console.log(`[SEC] Using base URL: ${this.baseUrl}`);
  }

  private get headers(): Record<string, string> {
    return {
      "Ocp-Apim-Subscription-Key": this.apiKey,
      Accept: "application/json",
    };
  }

  // ---- FundFactsheet endpoints (used by sync-sec-fund-directory) ----------

  async fetchAmcList(logPrefix = "[SEC]"): Promise<AmcRecord[]> {
    const url = `${this.baseUrl}/FundFactsheet/fund/amc`;
    const res = await fetchWithRetry(url, this.headers, MAX_RETRIES, logPrefix);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to list AMCs: HTTP ${res.status} — ${body.substring(0, 200)}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("AMC list is empty");
    }
    return data as AmcRecord[];
  }

  async fetchFundsByAmc(amcUniqueId: string, logPrefix = "[SEC]"): Promise<SecFundRecord[]> {
    const url = `${this.baseUrl}/FundFactsheet/fund/amc/${amcUniqueId}`;
    const res = await fetchWithRetry(url, this.headers, MAX_RETRIES, logPrefix);

    if (!res.ok) {
      console.warn(`${logPrefix} Failed to list funds for AMC ${amcUniqueId}: HTTP ${res.status}`);
      await res.text(); // consume body
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? (data as SecFundRecord[]) : [];
  }

  // ---- FundDailyInfo endpoints (used by NAV sync & backfill) --------------

  /**
   * Fetch daily NAV for a single fund on a specific date.
   * Returns the NAV per unit or null if no data / error.
   */
  async fetchDailyNav(
    projId: string,
    dateStr: string,
    logPrefix = "[SEC]",
  ): Promise<{ navPerUnit: number; status: "ok" } | { navPerUnit: null; status: "no_data" | "error" | "auth_error" }> {
    const url = `${this.baseUrl}/FundDailyInfo/${projId}/dailynav/${dateStr}`;
    const res = await fetchWithRetry(url, this.headers, MAX_RETRIES, logPrefix);

    // 204 = no data for this date (holiday/weekend)
    if (res.status === 204) {
      await res.text(); // consume body
      return { navPerUnit: null, status: "no_data" };
    }

    if (!res.ok) {
      await res.text(); // consume body
      if (res.status === 401) {
        console.error(`${logPrefix} 401 on FundDailyInfo — ensure your API key is subscribed to "Fund Daily Info" product`);
        return { navPerUnit: null, status: "auth_error" };
      }
      return { navPerUnit: null, status: "error" };
    }

    const data = await res.json();
    const navPerUnit = parseDailyNavResponse(data, `projId=${projId} date=${dateStr}`);

    if (navPerUnit === null) {
      return { navPerUnit: null, status: "no_data" };
    }

    return { navPerUnit, status: "ok" };
  }
}

export { THROTTLE_DELAY_MS };
