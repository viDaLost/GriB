import type { ReactNode } from 'react';

/** Native apps are already installed. Metro selects the web gate only for the website. */
export function InstallationGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
