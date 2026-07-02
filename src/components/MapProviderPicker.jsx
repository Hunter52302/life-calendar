import { MAP_PROVIDERS, buildMapUrl, copyText, openExternalUrl } from '../lib/handoffActions.js';

export default function MapProviderPicker({ open, destination, onClose }) {
  if (!open) return null;

  async function handleChoose(providerId) {
    if (providerId === 'copy') {
      await copyText(destination);
      onClose();
      return;
    }

    const url = buildMapUrl(providerId, destination);
    await openExternalUrl(url);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Open in Maps</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Choose a maps app. The selected provider receives this destination.
          </p>
        </div>
        <div className="p-2">
          {MAP_PROVIDERS.map(provider => (
            <button
              key={provider.id}
              type="button"
              onClick={() => handleChoose(provider.id)}
              className="w-full px-3 py-3 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {provider.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="w-full px-3 py-3 rounded-xl text-left text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
        <p className="px-5 pb-4 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
          Life Calendar only sends this address after you choose a provider.
        </p>
      </div>
    </div>
  );
}
