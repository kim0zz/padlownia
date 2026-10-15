import 'server-only';
/** Developer-only UI details (provenance IDs, release UUID, environment labels). */
export function showDevDetails(): boolean {
  return process.env.SHOW_DEV_DETAILS === '1';
}
