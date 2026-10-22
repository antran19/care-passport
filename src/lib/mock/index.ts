import { useTideCloak as useRealTideCloak } from "@tidecloak/nextjs";
import { useMockTideSafe } from "./MockProvider";

export function useTideCloak() {
  const mock = useMockTideSafe();
  if (process.env.NEXT_PUBLIC_MOCK === "1" && mock) {
    return mock;
  }
  return useRealTideCloak();
}

export * from "./mockData";
export * from "./mockTide";
export * from "./MockProvider";
