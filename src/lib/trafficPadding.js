/**
 * Free routing (OpenRouteService) returns FREE-FLOW drive times — no live
 * traffic. This approximates real-world congestion by padding the estimate
 * based on the local departure time: weekends and nights get little or none,
 * weekday rush hours get the most.
 *
 * Deterministic and coarse on purpose — it is a cheap stand-in for a paid
 * live-traffic provider, not a replacement for one.
 */
const HEAVY = 0.35; // ~ +35% at peak
const LIGHT = 0.10; // ~ +10% midday / shoulder hours

/**
 * @param {number} dayOfWeek 0=Sun … 6=Sat (local)
 * @param {number} hour      0–23 (local departure hour)
 * @returns {number} padding factor (0 = free-flow)
 */
export function trafficPaddingFactor(dayOfWeek, hour) {
  if (dayOfWeek === 0 || dayOfWeek === 6) return 0;            // weekends: free-flow
  if (hour >= 7 && hour < 10) return HEAVY;                    // morning rush
  if (hour >= 16 && hour < 19) return HEAVY;                   // evening rush
  if (hour >= 10 && hour < 16) return LIGHT;                   // midday
  if (hour === 6 || hour === 19 || hour === 20) return LIGHT;  // rush shoulders
  return 0;                                                    // early AM / late night
}

/**
 * Pad a free-flow duration for expected traffic at the departure time.
 * @returns {{ minutes: number, factor: number, pct: number }}
 */
export function applyTrafficPadding(baseMinutes, dayOfWeek, hour) {
  const factor = trafficPaddingFactor(dayOfWeek, hour);
  return {
    minutes: Math.round(baseMinutes * (1 + factor)),
    factor,
    pct: Math.round(factor * 100),
  };
}
