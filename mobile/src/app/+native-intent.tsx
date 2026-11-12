/**
 * The iOS share extension opens the app with a link like
 * honeydinner://dataUrl=honeydinnerShareKey. That isn't a screen, so send it to
 * the home screen; ShareIntentRouter in _layout then opens the import flow.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes('dataUrl=')) return '/';
  return path;
}
