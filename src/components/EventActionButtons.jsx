import { useState } from 'react';
import MapProviderPicker from './MapProviderPicker.jsx';
import { copyText, isLikelyUrl, openExternalUrl } from '../lib/handoffActions.js';

const buttonClass =
  'px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';

export default function EventActionButtons({ event }) {
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const location = event?.location?.trim() ?? '';
  const meetingUrl = event?.meeting_url?.trim() ?? '';
  const person = Array.isArray(event?.people) ? event.people[0] : null;

  if (!location && !meetingUrl && !person) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Opening another app sends the selected address or link to that provider. Life Calendar only sends it after you choose this action.
      </p>
      <div className="flex flex-wrap gap-2">
        {location && (
          <>
            <button type="button" onClick={() => setMapPickerOpen(true)} className={buttonClass}>
              Open in Maps
            </button>
            <button type="button" onClick={() => copyText(location)} className={buttonClass}>
              Copy location
            </button>
          </>
        )}
        {isLikelyUrl(meetingUrl) && (
          <>
            <button type="button" onClick={() => openExternalUrl(meetingUrl)} className={buttonClass}>
              Open meeting link
            </button>
            <button type="button" onClick={() => copyText(meetingUrl)} className={buttonClass}>
              Copy meeting link
            </button>
          </>
        )}
        {person?.phone && (
          <>
            <button type="button" onClick={() => openExternalUrl(`tel:${person.phone}`)} className={buttonClass}>
              Call
            </button>
            <button type="button" onClick={() => openExternalUrl(`sms:${person.phone}`)} className={buttonClass}>
              Text
            </button>
          </>
        )}
        {person?.email && (
          <button type="button" onClick={() => openExternalUrl(`mailto:${person.email}`)} className={buttonClass}>
            Email
          </button>
        )}
      </div>
      <MapProviderPicker
        open={mapPickerOpen}
        destination={location}
        onClose={() => setMapPickerOpen(false)}
      />
    </div>
  );
}
