"use client";

import { WorkspaceAppProvider } from "@/providers/WorkspaceAppProvider";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return <WorkspaceAppProvider>{children}</WorkspaceAppProvider>;
}
