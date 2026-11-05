/**
 * Asks Supabase which sign-in providers are switched on. The settings endpoint is
 * public, so the Google button can appear only once it is configured, instead of
 * showing a button that fails.
 */
export async function fetchEnabledProviders(): Promise<{ google: boolean }> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return { google: false };
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!response.ok) return { google: false };
    const settings = await response.json();
    return { google: settings?.external?.google === true };
  } catch {
    return { google: false };
  }
}

/** Error passed back in the URL when a sign-in link or Google sign-in fails. */
export function readAuthErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
  const description = params.get('error_description');
  return description ? description.replace(/\+/g, ' ') : null;
}
