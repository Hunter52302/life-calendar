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
export default function RouteAttribution({ className = '' }) {
  return (
    <p className={`text-[10px] leading-snug text-gray-400 dark:text-gray-500 ${className}`}>
      © openrouteservice.org by HeiGIT · Map data ©{' '}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-600 dark:hover:text-gray-300"
      >
        OpenStreetMap contributors
      </a>
    </p>
  );
}
