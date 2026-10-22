"use client";

import { TideCloakProvider } from "@tidecloak/nextjs";
import tcConfig from "../../data/tidecloak.json";
import { ProfileOnboarding } from "@/components/ProfileOnboarding";
import { MockProvider } from "@/lib/mock";

// The provider takes the adapter JSON directly as the config prop.
// useDPoP goes inside the config object, not as a separate JSX prop (I-12).
export function Providers({ children }: { children: React.ReactNode }) {
  const isMock = process.env.NEXT_PUBLIC_MOCK === "1";

  if (isMock) {
    return <MockProvider>{children}</MockProvider>;
  }

  return (
    <TideCloakProvider
      config={{ ...tcConfig, useDPoP: { mode: "strict", alg: "ES256" } }}
    >
      {children}
      <ProfileOnboarding
        baseUrl={tcConfig["auth-server-url"]}
        realm={tcConfig.realm}
        fields={["firstName", "lastName"]}
      />
    </TideCloakProvider>
  );
}

