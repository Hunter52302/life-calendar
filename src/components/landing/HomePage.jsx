import { Link, useOutletContext } from 'react-router-dom';

const FEATURES = [
  {
    title: 'Plan vs. reality',
    body: 'Lay out the week you intend to live, log what actually happened, then see the gap. The "See Your Life" view turns the difference into something you can act on.',
    icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
  },
  {
    title: 'Zero-knowledge by default',
    body: 'Your password encrypts everything client-side. The server only ever stores ciphertext — nobody but you can read your calendar, not even us.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Habits & budgets',
    body: 'Track streaks and set weekly time budgets per category — all in one place, all encrypted.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  },
  {
    title: 'Yours on every device',
    body: 'Use it in the browser, install the PWA, or download the native desktop and mobile apps. Connect Google, Outlook, or any iCal feed to keep it in sync.',
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
];

export default function HomePage() {
  const { onEnter } = useOutletContext();

  return (
    <>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Private by design · zero-knowledge encryption
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
          Plan the life you want.
          <br />
          <span className="text-indigo-500">See the life you live.</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
          PLS Calendar is a private, encrypted weekly planner that compares the week you
          intended to live with the one you actually lived — then helps you close the gap.
          Nothing loads or syncs until you sign in.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onEnter}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition-colors shadow-sm"
          >
            Get started — it's free
          </button>
          <Link
            to="/downloads"
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            Download the app
          </Link>
        </div>
        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          No browser data is stored until you log in — read the{' '}
          <Link to="/docs" className="text-indigo-500 hover:underline">docs</Link> and download freely first.
        </p>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-5 py-16 border-t border-gray-100 dark:border-gray-800">
        <h2 className="text-2xl sm:text-3xl font-bold text-center">Everything in one private place</h2>
        <p className="mt-3 text-center text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          A planner, a habit tracker, and time budgets — all end-to-end encrypted.
        </p>
        <div className="mt-12 grid sm:grid-cols-2 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 bg-gray-50/50 dark:bg-gray-900/40">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                </svg>
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-5 py-16 border-t border-gray-100 dark:border-gray-800 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold">Ready when you are</h2>
        <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
          Create a free account in seconds, or install the native app for your device.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onEnter}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition-colors shadow-sm"
          >
            Log in / Sign up
          </button>
          <Link
            to="/downloads"
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            See downloads
          </Link>
        </div>
      </section>
    </>
  );
}
