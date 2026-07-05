/**
 * Required attribution for drive-time estimates.
 *
 * OpenRouteService's Terms of Service require crediting ORS and OpenStreetMap
 * whenever OSM-derived data is shown to an end user, and OpenStreetMap's
 * attribution guidelines require the "© OpenStreetMap contributors" credit to
 * link to openstreetmap.org/copyright. Nominatim (used for geocoding) likewise
 * asks that attribution be displayed as suitable for the medium. This one
 * component satisfies all three and is rendered wherever an estimate appears.
 */
import { openExternalUrl } from '../lib/handoffActions.js';

const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

export default function RouteAttribution({ className = '' }) {
  return (
    <p className={`text-[10px] leading-snug text-gray-400 dark:text-gray-500 ${className}`}>
      © openrouteservice.org by HeiGIT · Map data ©{' '}
      <a
        href={OSM_COPYRIGHT_URL}
        target="_blank"
        rel="noopener noreferrer"
        // Route through openExternalUrl so the required copyright link also
        // opens in the desktop (Tauri) webview, where target=_blank is a no-op.
        onClick={e => { e.preventDefault(); openExternalUrl(OSM_COPYRIGHT_URL); }}
        className="underline hover:text-gray-600 dark:hover:text-gray-300"
      >
        OpenStreetMap contributors
      </a>
    </p>
  );
}
