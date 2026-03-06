import type { NavProvider } from "./types.ts";
import { MockNavProvider } from "./providers/mock.ts";
import { SecThNavProvider } from "./providers/sec.ts";

export function getNavProvider(): { provider: NavProvider; providerName: string } {
  const providerName = Deno.env.get("NAV_PROVIDER") ?? "mock";

  switch (providerName) {
    case "sec":
      return { provider: new SecThNavProvider(), providerName: "sec" };
    case "mock":
    default:
      return { provider: new MockNavProvider(), providerName: "mock" };
  }
}
