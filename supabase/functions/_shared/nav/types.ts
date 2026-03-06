export interface NavResult {
  fundCode: string;
  navDate: string; // YYYY-MM-DD
  navPerUnit: number;
  source: string;
}

export interface NavProvider {
  fetchLatestNavForFund(fundCode: string): Promise<NavResult | null>;
  fetchLatestNavForFunds(fundCodes: string[]): Promise<NavResult[]>;
}
