import type { NavProvider } from "./types.ts";
import { MockNavProvider } from "./providers/mock.ts";
import { SecThNavProvider } from "./providers/sec.ts";

export function getNavProvider(): NavProvider {
  const provider = Deno.env.get("NAV_PROVIDER") ?? "mock";

  switch (provider) {
    case "sec":
      return new SecThNavProvider();
    case "mock":
    default:
      return new MockNavProvider();
  }
}
