export interface InstallEnvironment {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone?: boolean;
  standaloneDisplay: boolean;
}

/** iPad can identify itself as a Mac when Safari requests desktop websites. */
export function needsIOSInstallation(environment: InstallEnvironment): boolean {
  const ios = /iPhone|iPad|iPod/i.test(environment.userAgent)
    || (environment.platform === 'MacIntel' && environment.maxTouchPoints > 1);
  return ios && environment.standalone !== true && !environment.standaloneDisplay;
}
