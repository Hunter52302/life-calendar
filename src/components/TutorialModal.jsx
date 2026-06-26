import { useState, useEffect } from 'react';

// ── Shared icons (one per topic, reused across that topic's steps) ───────────
function IconWelcome() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect x="4" y="6" width="32" height="28" rx="4" className="fill-indigo-100 dark:fill-indigo-900/40" />
      <rect x="4" y="6" width="32" height="8" rx="4" className="fill-indigo-500" />
      <rect x="10" y="19" width="8" height="2" rx="1" className="fill-indigo-300 dark:fill-indigo-600" />
      <rect x="10" y="24" width="14" height="2" rx="1" className="fill-indigo-200 dark:fill-indigo-700" />
      <rect x="22" y="19" width="8" height="7" rx="1" className="fill-indigo-400/60 dark:fill-indigo-600/60" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <path d="M20 4l13 5v9c0 9-6 15-13 18-7-3-13-9-13-18v-9l13-5z" className="fill-emerald-100 dark:fill-emerald-900/40" stroke="#34D399" strokeWidth="1.5" />
      <path d="M14 20l4.5 4.5L27 15" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTabs() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect x="3" y="10" width="10" height="22" rx="3" className="fill-blue-400" />
      <rect x="15" y="10" width="10" height="22" rx="3" className="fill-green-400" />
      <rect x="27" y="10" width="10" height="22" rx="3" className="fill-purple-400" />
      <rect x="5" y="16" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
      <rect x="5" y="19" width="4" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
      <rect x="17" y="16" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
      <rect x="17" y="19" width="4" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
      <rect x="29" y="16" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
      <rect x="29" y="19" width="4" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
    </svg>
  );
}
function IconEvent() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect x="4" y="4" width="32" height="32" rx="5" className="fill-blue-50 dark:fill-blue-900/30" />
      <circle cx="28" cy="28" r="9" className="fill-blue-500" />
      <path d="M24 28h8M28 24v8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="9" y="10" width="14" height="3" rx="1.5" className="fill-blue-200 dark:fill-blue-700" />
      <rect x="9" y="16" width="10" height="2" rx="1" className="fill-blue-100 dark:fill-blue-800" />
    </svg>
  );
}
function IconCar() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" className="fill-orange-50 dark:fill-orange-900/30" />
      <path d="M11 24h18M9.5 16l2-5a1.5 1.5 0 0 1 1.4-1h14.2a1.5 1.5 0 0 1 1.4 1l2 5M9.5 16H7a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1.5m23-7h2.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H31" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="13" cy="24" r="2.3" className="fill-orange-500" />
      <circle cx="27" cy="24" r="2.3" className="fill-orange-500" />
    </svg>
  );
}
function IconCategories() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <circle cx="10" cy="12" r="5" fill="#F87171" />
      <circle cx="22" cy="12" r="5" fill="#34D399" />
      <circle cx="34" cy="12" r="5" fill="#60A5FA" />
      <circle cx="10" cy="28" r="5" fill="#FBBF24" />
      <circle cx="22" cy="28" r="5" fill="#A78BFA" />
      <circle cx="34" cy="28" r="5" fill="#F472B6" />
    </svg>
  );
}
function IconViews() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect x="4" y="4" width="32" height="32" rx="4" className="fill-gray-100 dark:fill-gray-700" />
      <rect x="8" y="8" width="6" height="6" rx="1" className="fill-indigo-400" />
      <rect x="17" y="8" width="6" height="6" rx="1" className="fill-indigo-300" />
      <rect x="26" y="8" width="6" height="6" rx="1" className="fill-indigo-200 dark:fill-indigo-700" />
      <rect x="8" y="17" width="6" height="6" rx="1" className="fill-indigo-200 dark:fill-indigo-700" />
      <rect x="17" y="17" width="6" height="6" rx="1" className="fill-indigo-400" />
      <rect x="26" y="17" width="6" height="6" rx="1" className="fill-indigo-300" />
      <rect x="8" y="26" width="6" height="6" rx="1" className="fill-indigo-300" />
      <rect x="17" y="26" width="6" height="6" rx="1" className="fill-indigo-200 dark:fill-indigo-700" />
      <rect x="26" y="26" width="6" height="6" rx="1" className="fill-indigo-400" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <circle cx="18" cy="18" r="11" className="stroke-indigo-400 dark:stroke-indigo-500" strokeWidth="3" fill="none" />
      <path d="M26.5 26.5L35 35" className="stroke-indigo-500 dark:stroke-indigo-400" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 18h10M18 13v10" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconQuickAdd() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <circle cx="17" cy="17" r="14" className="fill-purple-50 dark:fill-purple-900/30" />
      <path d="M17 11a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0v-4a4 4 0 0 1 4-4z" stroke="#8B5CF6" strokeWidth="2" />
      <path d="M11 19a6 6 0 0 0 12 0M17 25v3" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
      <path d="M31 8l1.4 3.2L35.5 12.5l-3.1 1.4L31 17l-1.4-3.1-3.1-1.4 3.1-1.3L31 8z" fill="#F472B6" />
    </svg>
  );
}
function IconCalendarLink() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect x="4" y="9" width="20" height="20" rx="3" className="fill-teal-100 dark:fill-teal-900/40" />
      <rect x="6" y="9" width="16" height="5" rx="2" className="fill-teal-400" />
      <rect x="9" y="19" width="4" height="4" rx="1" className="fill-teal-400" />
      <rect x="16" y="19" width="4" height="4" rx="1" className="fill-teal-300 dark:fill-teal-600" />
      <circle cx="29" cy="27" r="7" className="fill-teal-500" />
      <path d="M26.3 27a2.7 2.7 0 0 1 2.7-2.7h1.4M31.7 27a2.7 2.7 0 0 1-2.7 2.7h-1.4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconDiff() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect x="4" y="8" width="14" height="24" rx="3" className="fill-blue-200 dark:fill-blue-800" />
      <rect x="22" y="8" width="14" height="24" rx="3" className="fill-green-200 dark:fill-green-800" />
      <rect x="6" y="12" width="10" height="3" rx="1.5" className="fill-blue-400" />
      <rect x="6" y="18" width="7" height="3" rx="1.5" className="fill-blue-300" />
      <rect x="6" y="24" width="9" height="3" rx="1.5" className="fill-blue-400" />
      <rect x="24" y="14" width="10" height="3" rx="1.5" className="fill-green-400" />
      <rect x="24" y="21" width="7" height="3" rx="1.5" className="fill-green-300" />
      <rect x="24" y="27" width="9" height="3" rx="1.5" className="fill-green-400" />
    </svg>
  );
}
function IconHabit() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <path d="M20 5c5 6-2 7-2 12a6 6 0 0 0 12 0c0-2-1-4-1-4 1 6-2 9-5 9-3 0-5-2-5-5 0-4 4-6 4-10-1-1-2-2-3-2z" className="fill-orange-400" />
      <path d="M14 17c2 3-1 4-1 7a5 5 0 0 0 10 0c0-1.5-.7-3-.7-3 .7 4-1.3 6-3.3 6s-3.3-1.3-3.3-3.3c0-2.7 2.7-4 2.7-6.7-.6-.6-1.3-1.3-2-1.3z" className="fill-orange-300 dark:fill-orange-500/70" />
      <rect x="6" y="32" width="28" height="3" rx="1.5" className="fill-orange-100 dark:fill-orange-900/40" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <circle cx="18" cy="18" r="14" className="fill-slate-100 dark:fill-slate-700" stroke="#94A3B8" strokeWidth="1.5" />
      <path d="M4 18h28M18 4c4 4 6 9 6 14s-2 10-6 14c-4-4-6-9-6-14s2-10 6-14z" stroke="#94A3B8" strokeWidth="1.3" fill="none" />
      <circle cx="29" cy="29" r="8" className="fill-slate-500" />
      <path d="M29 25v4l3 2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconFont() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect x="4" y="4" width="32" height="32" rx="6" className="fill-pink-50 dark:fill-pink-900/30" />
      <text x="9" y="26" fontSize="18" fontWeight="700" className="fill-pink-500" fontFamily="serif">Aa</text>
      <path d="M28 11l1.6 3.6 3.6 1.6-3.6 1.6L28 21.4l-1.6-3.6-3.6-1.6 3.6-1.6L28 11z" className="fill-indigo-400" />
    </svg>
  );
}

// ── Topic content ──────────────────────────────────────────────────────────
// Every topic is a self-contained multi-step wizard. Step 0 of each topic is
// always the "intro" slide (Skip / Let's go); the rest use Back/Next/Done.
export const TOPICS = [
  {
    id: 'basics',
    label: 'Quick Tour',
    blurb: 'The 2-minute version for new users — what Life Calendar does and how to get around.',
    icon: <IconWelcome />,
    gradient: 'from-indigo-400 via-blue-400 to-purple-400',
    recommended: true,
    steps: [
      {
        intro: true,
        icon: <IconWelcome />,
        title: 'Welcome to Life Calendar',
        body: (
          <>
            <p className="mb-3">Life Calendar helps you close the gap between how you plan your time and how you actually spend it.</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">This is the short version. For a deep dive into any specific feature, reopen this from <span className="font-medium text-gray-700 dark:text-gray-300">Settings → Tutorial</span> any time — you'll get to pick exactly what you want to learn about.</p>
          </>
        ),
      },
      {
        icon: <IconTabs />,
        title: 'Three Tabs',
        body: (
          <>
            <p className="mb-2">The app has three main views, selectable from the top:</p>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-2 align-middle" /><strong className="text-gray-800 dark:text-gray-200">Plan</strong> — block out how you intend to use your time</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 align-middle" /><strong className="text-gray-800 dark:text-gray-200">Live</strong> — record what you actually did</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-purple-400 mr-2 align-middle" /><strong className="text-gray-800 dark:text-gray-200">See Your Life</strong> — compare plan vs reality side by side</li>
            </ul>
          </>
        ),
      },
      {
        icon: <IconEvent />,
        title: 'Add Your First Event',
        body: (
          <>
            <p className="mb-2">Two ways to add an event:</p>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li><span className="font-semibold text-gray-800 dark:text-gray-200">Tap a time slot</span> on the calendar grid</li>
              <li><span className="font-semibold text-gray-800 dark:text-gray-200">Tap the + button</span> in the corner for more options, including pasting text or speaking an event</li>
            </ul>
          </>
        ),
      },
      {
        icon: <IconViews />,
        title: 'There\'s More Under the Hood',
        body: (
          <>
            <p className="mb-2">Categories, calendar imports, drive-time tracking, voice notes, AI-assisted parsing, multiple time zones, fonts, habits, and data export are all in here too.</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Open <span className="font-medium text-gray-700 dark:text-gray-300">Settings → Tutorial</span> whenever you want a focused walkthrough of one of these — no need to sit through everything at once.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'security',
    label: 'Your Account & Privacy',
    blurb: 'What zero-knowledge encryption means here, and how your password protects your data.',
    icon: <IconShield />,
    gradient: 'from-emerald-400 via-teal-400 to-cyan-400',
    steps: [
      {
        intro: true,
        icon: <IconShield />,
        title: 'Your Account & Privacy',
        body: (
          <>
            <p className="mb-3">Life Calendar uses <strong className="text-gray-800 dark:text-gray-200">zero-knowledge encryption</strong>. That means the server stores your data, but it never sees the unencrypted contents — only your browser ever holds the key that can read it.</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">This tour explains what that means in practice and what to do if you lose your password.</p>
          </>
        ),
      },
      {
        icon: <IconShield />,
        title: 'How the encryption works',
        body: (
          <>
            <p className="mb-2">On first run you set a password. Your browser turns it into an encryption key using PBKDF2 (600,000 iterations) and AES-256-GCM — industry-standard, computationally expensive on purpose to resist guessing.</p>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li>The key is derived <strong className="text-gray-800 dark:text-gray-200">locally in your browser</strong> — your raw password never leaves your device</li>
              <li>Events, categories, and settings are encrypted before they're sent to the server</li>
              <li>The server only ever stores ciphertext it cannot read</li>
            </ul>
          </>
        ),
      },
      {
        icon: <IconShield />,
        title: 'What "zero-knowledge" really means',
        body: (
          <>
            <p className="mb-2">Nobody but you — not the server, not an attacker who steals the database — can read your plan, your live log, or your settings without your password.</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">A side effect: there's no "forgot password" reset that recovers your data, because the server genuinely cannot decrypt it for you. A wrong password doesn't show an error message — it just fails to unlock anything, since decryption itself fails.</p>
          </>
        ),
      },
      {
        icon: <IconShield />,
        title: 'Staying unlocked',
        body: (
          <>
            <p className="mb-2">By default, your decryption key lives only in memory — refreshing the page re-prompts you for your password.</p>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li><strong className="text-gray-800 dark:text-gray-200">Stay unlocked on this device</strong> — opt in at unlock time to keep the key in this browser tab's session storage. It's cleared the moment you close the tab, and is never written to localStorage or disk.</li>
              <li>Use a recovery code (if you generated one) to regain access if you forget your password — keep it somewhere safe, since it's the only backdoor by design.</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    id: 'tabs',
    label: 'Plan, Live & See Your Life',
    blurb: 'The three core views and how they work together to show you the gap.',
    icon: <IconTabs />,
    gradient: 'from-blue-400 via-green-400 to-purple-400',
    steps: [
      {
        intro: true,
        icon: <IconTabs />,
        title: 'Plan, Live & See Your Life',
        body: (
          <p>These three tabs are the heart of the app: one for intentions, one for reality, and one that shows you the difference.</p>
        ),
      },
      {
        icon: <IconTabs />,
        title: 'Plan',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Block out how you <em>intend</em> to spend your time — meetings, workouts, sleep, deep work. Plan events can repeat, span multiple days, and be imported from other calendars.</p>
        ),
      },
      {
        icon: <IconTabs />,
        title: 'Live',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Log what you <em>actually</em> did, after the fact or in real time. Drive Time entries and voice/text quick-adds land here by default. This is your record of reality.</p>
        ),
      },
      {
        icon: <IconDiff />,
        title: 'See Your Life',
        body: (
          <>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Compares Plan against Live over any date range — totals per category, where you drifted, and whether you're hitting time budgets you've set.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">See the "See Your Life & Exporting" topic for details on exporting this comparison.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'events',
    label: 'Adding Events & Drive Time',
    blurb: 'Creating events, multi-day spans, and automatic drive-time calculation.',
    icon: <IconEvent />,
    gradient: 'from-blue-400 via-sky-400 to-orange-400',
    steps: [
      {
        intro: true,
        icon: <IconEvent />,
        title: 'Adding Events & Drive Time',
        body: <p>Events are the building blocks of both Plan and Live. This walkthrough covers creating them and using the automatic drive-time feature.</p>,
      },
      {
        icon: <IconEvent />,
        title: 'Two ways to add an event',
        body: (
          <>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li><span className="font-semibold text-gray-800 dark:text-gray-200">Tap a time slot</span> on the calendar grid — opens the event form pre-filled with that time</li>
              <li><span className="font-semibold text-gray-800 dark:text-gray-200">+ button (FAB)</span> — add to Plan, add to Live, log Drive Time, paste text, or speak an event</li>
            </ul>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Every event has a label, a category, a start/end time (or "all day"), and can span multiple days — multi-day events are automatically split into one segment per day.</p>
          </>
        ),
      },
      {
        icon: <IconCar />,
        title: 'Drive Time — how it works',
        body: (
          <>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Open the FAB and choose <strong className="text-gray-800 dark:text-gray-200">Drive Time</strong>. Enter a <strong>From</strong> and <strong>To</strong> address (your saved home address pre-fills "From").</p>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li>The app calculates the route using open-source routing (OSRM) based on the two addresses you give it</li>
              <li>Once both fields are filled, it automatically estimates duration and distance</li>
              <li>Your event's end time is set automatically — rounded up to the nearest 30-minute slot from the estimated drive duration</li>
              <li>You can still edit the time manually if the estimate is off</li>
            </ul>
          </>
        ),
      },
      {
        icon: <IconCar />,
        title: 'Where Drive Time events live',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Drive Time always saves to <strong className="text-gray-800 dark:text-gray-200">Live</strong>, under its own orange "Drive Time" category, so your commute time shows up honestly in See Your Life without you having to plan it in advance.</p>
        ),
      },
    ],
  },
  {
    id: 'categories',
    label: 'Categories',
    blurb: 'Color-coding, filtering, pinning, and managing categories.',
    icon: <IconCategories />,
    gradient: 'from-rose-400 via-amber-400 to-violet-400',
    steps: [
      {
        intro: true,
        icon: <IconCategories />,
        title: 'Categories',
        body: <p>Every event belongs to a category with its own color, so you can see at a glance how your time is distributed.</p>,
      },
      {
        icon: <IconCategories />,
        title: 'Filtering & pinning',
        body: (
          <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
            <li><span className="font-semibold text-gray-800 dark:text-gray-200">Filter</span> — click "Categories" in the toolbar to show or hide specific categories on the calendar</li>
            <li><span className="font-semibold text-gray-800 dark:text-gray-200">Pin</span> — star a category to keep it visible in the legend for quick reference</li>
          </ul>
        ),
      },
      {
        icon: <IconCategories />,
        title: 'Customizing',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Add, rename, or recolor categories from <strong className="text-gray-800 dark:text-gray-200">Settings → Manage Categories</strong>. Drive Time has its own built-in category so commute time is always tracked separately from everything else.</p>
        ),
      },
    ],
  },
  {
    id: 'views',
    label: 'Calendar Views',
    blurb: 'Day, week, month, quarter, half-year, and year views.',
    icon: <IconViews />,
    gradient: 'from-indigo-400 via-indigo-300 to-indigo-200',
    steps: [
      {
        intro: true,
        icon: <IconViews />,
        title: 'Calendar Views',
        body: <p>Switch how much time you see at once from the toolbar above the calendar.</p>,
      },
      {
        icon: <IconViews />,
        title: 'Day & Week',
        body: <p className="text-sm text-gray-600 dark:text-gray-400">An hour-by-hour timeline. Toggle 30-minute precision for finer-grained event placement when you need it.</p>,
      },
      {
        icon: <IconViews />,
        title: 'Month',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">A full-month grid. <span className="text-indigo-500 dark:text-indigo-400 font-medium">Click any week number</span> to jump straight to that week's day view.</p>
        ),
      },
      {
        icon: <IconViews />,
        title: 'Quarter / Half-Year / Year',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Big-picture views for spotting longer-term patterns. Enable them in <strong className="text-gray-800 dark:text-gray-200">Settings → Appearance → Extra views</strong>.</p>
        ),
      },
    ],
  },
  {
    id: 'search',
    label: 'Search',
    blurb: 'Finding any event fast with the search overlay.',
    icon: <IconSearch />,
    gradient: 'from-indigo-400 via-blue-400 to-indigo-300',
    steps: [
      {
        intro: true,
        icon: <IconSearch />,
        title: 'Search',
        body: (
          <p>Press <kbd className="px-1.5 py-0.5 text-xs font-mono border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">⌘K</kbd> (or <kbd className="px-1.5 py-0.5 text-xs font-mono border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">Ctrl K</kbd> on Windows) anywhere in the app to open the search overlay.</p>
        ),
      },
      {
        icon: <IconSearch />,
        title: 'What it searches',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Search finds events across <strong className="text-gray-800 dark:text-gray-200">both Plan and Live</strong> calendars by label or category name. Clicking a result jumps directly to that event on the calendar, switching tabs and date if needed.</p>
        ),
      },
      {
        icon: <IconSearch />,
        title: 'Customizing the shortcut',
        body: (
          <p className="text-sm text-gray-500 dark:text-gray-400">You can change the keyboard shortcut in <strong className="text-gray-700 dark:text-gray-300">Settings → Search Options</strong> if ⌘K/Ctrl K conflicts with something else.</p>
        ),
      },
    ],
  },
  {
    id: 'quickAdd',
    label: 'Quick Add, Voice & AI Parsing',
    blurb: 'Turn pasted text or your voice into events, with optional LLM help.',
    icon: <IconQuickAdd />,
    gradient: 'from-purple-400 via-pink-400 to-red-400',
    steps: [
      {
        intro: true,
        icon: <IconQuickAdd />,
        title: 'Quick Add, Voice & AI Parsing',
        body: (
          <p>Instead of filling out a form for every event, you can paste in messy text or just talk — the app finds the dates, times, and event names for you.</p>
        ),
      },
      {
        icon: <IconQuickAdd />,
        title: 'Quick Add from text',
        body: (
          <>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Open the FAB → <strong className="text-gray-800 dark:text-gray-200">From Text</strong>. Paste anything with dates and times in it — a shift schedule, an email, a text message thread.</p>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li>By default a free, fully offline local parser detects events — no internet or API key needed</li>
              <li>Each detected event shows as its own card with a confidence badge (<em>exact</em>, <em>approx</em>, or <em>inferred</em>)</li>
              <li>Review, edit, toggle off, or recategorize each one before adding — nothing is added until you confirm</li>
              <li>On Android, once installed to your home screen, you can highlight text in any app and Share it straight into this screen (iOS doesn't support sharing into installed web apps)</li>
            </ul>
          </>
        ),
      },
      {
        icon: <IconQuickAdd />,
        title: 'Voice noting',
        body: (
          <>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Open the FAB → <strong className="text-gray-800 dark:text-gray-200">Record Voice</strong>, or tap the 🎤 icon inside the "From Text" box, then just speak.</p>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li>Uses your browser's built-in speech recognition — no audio is uploaded anywhere outside the parsing step</li>
              <li>Your words are transcribed live into the text box as you talk</li>
              <li>Keep the tab open and focused while speaking — recognition stops if you switch away</li>
              <li>Once you stop, it's parsed into event cards exactly like pasted text</li>
            </ul>
          </>
        ),
      },
      {
        icon: <IconQuickAdd />,
        title: 'Connecting your own LLM',
        body: (
          <>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">For smarter multi-event extraction and category guessing, connect an LLM in <strong className="text-gray-800 dark:text-gray-200">Settings → Text/Voice Parsing</strong> — this is entirely optional.</p>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li>Choose a provider: <strong>Anthropic</strong>, <strong>OpenAI</strong>, or a <strong>custom endpoint</strong> (e.g. a local Ollama server)</li>
              <li>Paste your API key and optionally a model name (e.g. <code>claude-3-5-haiku-latest</code>, <code>gpt-4o-mini</code>, <code>llama3.1</code>)</li>
              <li>Your text and key go <strong className="text-gray-800 dark:text-gray-200">directly from your browser to that provider</strong> — never through the app's own server</li>
              <li>If a request ever fails (bad key, offline, rate limit), parsing silently falls back to the local parser — it never blocks you from adding events</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    id: 'calendars',
    label: 'Connected Calendars (.ics)',
    blurb: 'Linking Google/Outlook, importing/exporting .ics files, and live subscriptions.',
    icon: <IconCalendarLink />,
    gradient: 'from-teal-400 via-cyan-400 to-blue-400',
    steps: [
      {
        intro: true,
        icon: <IconCalendarLink />,
        title: 'Connected Calendars',
        body: (
          <p>You don't have to leave your other calendars behind. There are three ways to bring outside events into Life Calendar, all under <strong className="text-gray-800 dark:text-gray-200">Settings → Connected Calendars</strong>.</p>
        ),
      },
      {
        icon: <IconCalendarLink />,
        title: 'Connect Google or Outlook',
        body: (
          <>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Click "Connect Google" or "Connect Outlook" to sign in via OAuth. After signing in, pick which of that account's calendars to import, and whether it goes into <strong className="text-gray-800 dark:text-gray-200">Plan</strong> or <strong className="text-gray-800 dark:text-gray-200">Live</strong>.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Sign-in tokens are stored on the server, not in your browser — this component only ever handles the event data itself, and connections can be disconnected at any time.</p>
          </>
        ),
      },
      {
        icon: <IconCalendarLink />,
        title: 'Import / export .ics files',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Use <strong className="text-gray-800 dark:text-gray-200">Export .ics</strong> to download your Plan or Live calendar as a standard file you can open elsewhere, or <strong className="text-gray-800 dark:text-gray-200">Import .ics</strong> to bring in a file someone sent you or exported from another app.</p>
        ),
      },
      {
        icon: <IconCalendarLink />,
        title: 'Subscribing to a live URL',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Paste a secret ICS address (e.g. Google Calendar → Settings → "Secret address in iCal format", or any <code>webcal:</code>/<code>.ics</code> URL) to subscribe — it auto-refreshes roughly every 30 minutes so changes on the source calendar keep showing up here.</p>
        ),
      },
      {
        icon: <IconCalendarLink />,
        title: 'Publishing your calendar',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Flip it around: generate a secret URL from this same section that Google Calendar, Outlook, or Apple Calendar can subscribe to, so your Life Calendar plan shows up in those apps too.</p>
        ),
      },
    ],
  },
  {
    id: 'seeYourLife',
    label: 'See Your Life & Exporting',
    blurb: 'Comparing plan vs reality, and downloading the comparison as CSV, JSON, or PDF.',
    icon: <IconDiff />,
    gradient: 'from-blue-400 via-green-400 to-emerald-400',
    steps: [
      {
        intro: true,
        icon: <IconDiff />,
        title: 'See Your Life & Exporting',
        body: <p>This is the "reality check" — and the data behind it is yours to take with you.</p>,
      },
      {
        icon: <IconDiff />,
        title: 'Reading the comparison',
        body: (
          <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
            <li>Pick any date range to compare Plan against Live</li>
            <li>See total planned vs actual hours, broken down per category</li>
            <li>Spot where your time consistently drifts from what you intended</li>
            <li>If you've set time budgets per category, see how close you came to them</li>
          </ul>
        ),
      },
      {
        icon: <IconDiff />,
        title: 'Downloading your data',
        body: (
          <>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Go to <strong className="text-gray-800 dark:text-gray-200">Settings → Export Data</strong>, pick a format, and click Download:</p>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li><strong className="text-gray-800 dark:text-gray-200">CSV</strong> — raw rows for spreadsheets</li>
              <li><strong className="text-gray-800 dark:text-gray-200">JSON</strong> — structured data for your own scripts/tools</li>
              <li><strong className="text-gray-800 dark:text-gray-200">PDF</strong> — a formatted report you can save or share</li>
            </ul>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">The export covers the same date range currently selected in See Your Life.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'habits',
    label: 'Habits',
    blurb: 'Tracking streaks and recurring routines outside the calendar grid.',
    icon: <IconHabit />,
    gradient: 'from-orange-400 via-amber-400 to-yellow-400',
    steps: [
      {
        intro: true,
        icon: <IconHabit />,
        title: 'Habits',
        body: <p>Habits track recurring routines — things you do on a schedule rather than at a specific calendar time.</p>,
      },
      {
        icon: <IconHabit />,
        title: 'Creating a habit',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Give it a label and a color, then choose which days it applies to — daily, weekdays only, weekends only, or any custom combination of days.</p>
        ),
      },
      {
        icon: <IconHabit />,
        title: 'Streaks',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Check off a habit each day it's due to build a streak. A heatmap shows your consistency over time, and "today's habits" are separated from ones not scheduled for today so you always know what's left to do.</p>
        ),
      },
    ],
  },
  {
    id: 'timezones',
    label: 'Time Zones',
    blurb: 'Tracking up to five time zones at once.',
    icon: <IconGlobe />,
    gradient: 'from-slate-400 via-slate-300 to-slate-200',
    steps: [
      {
        intro: true,
        icon: <IconGlobe />,
        title: 'Time Zones',
        body: <p>If you coordinate across time zones — remote teams, travel, family abroad — you can track several at once.</p>,
      },
      {
        icon: <IconGlobe />,
        title: 'Adding & removing zones',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">In <strong className="text-gray-800 dark:text-gray-200">Settings → Time Zones</strong>, your primary zone is detected automatically. Add up to four more by searching for a city or IANA zone name (e.g. "Tokyo" or "Asia/Tokyo").</p>
        ),
      },
      {
        icon: <IconGlobe />,
        title: "Why it's useful",
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Extra time zones display alongside your local time, so you can schedule a cross-timezone meeting or call without doing the math yourself.</p>
        ),
      },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance, Fonts & Text',
    blurb: 'Dark mode, fonts, accessibility text options, and other display settings.',
    icon: <IconFont />,
    gradient: 'from-pink-400 via-rose-400 to-indigo-400',
    steps: [
      {
        intro: true,
        icon: <IconFont />,
        title: 'Appearance, Fonts & Text',
        body: <p>Everything about how the app looks lives in one place: Settings → Appearance.</p>,
      },
      {
        icon: <IconFont />,
        title: 'The font picker',
        body: (
          <>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Search across grouped font presets — each with a live "Abc" preview:</p>
            <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
              <li><strong className="text-gray-800 dark:text-gray-200">Default</strong> — your system font</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Accessibility</strong> — OpenDyslexic, Atkinson Hyperlegible, Lexend</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Sans-serif / Serif / Monospace</strong> — Inter, Nunito, Open Sans, Merriweather, Lora, JetBrains Mono</li>
            </ul>
          </>
        ),
      },
      {
        icon: <IconFont />,
        title: 'Custom fonts',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Don't see what you want? Upload your own font file (<code>.ttf</code>, <code>.otf</code>, <code>.woff</code>, or <code>.woff2</code>) and it applies across the whole app immediately.</p>
        ),
      },
      {
        icon: <IconFont />,
        title: 'Other display options',
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-400">Also in Appearance: dark mode, 24-hour time, week numbers, minimalist mode, your mobile default view, floating-button dragging, and toggles for the extra Quarter/Half-Year/Year calendar views.</p>
        ),
      },
    ],
  },
];

export default function TutorialModal({ topicId = 'basics', onClose, onBack }) {
  const topic = TOPICS.find(t => t.id === topicId) ?? TOPICS[0];
  const STEPS = topic.steps;
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];

  // Reset to the first step whenever the topic changes (e.g. picking a new
  // topic from the hub without fully closing the modal).
  useEffect(() => { setStep(0); }, [topicId]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Accent bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${topic.gradient}`} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 uppercase tracking-wider transition-colors"
            >
              ← All topics
            </button>
          ) : (
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Tutorial
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-base leading-none"
            aria-label="Close tutorial"
          >
            ✕
          </button>
        </div>

        {/* Step content */}
        <div className="px-5 pt-3 pb-5 flex flex-col items-center text-center min-h-[300px]">
          {/* Icon */}
          <div className="mb-4 mt-1">
            {current.icon}
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
            {current.title}
          </h2>

          {/* Body */}
          <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed w-full">
            {typeof current.body === 'string' ? <p>{current.body}</p> : current.body}
          </div>
        </div>

        {/* Footer */}
        {current.intro ? (
          /* Intro slide — Skip / Let's go */
          <div className="flex items-center justify-center gap-3 px-5 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-6 py-2 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
            >
              Let's go
            </button>
          </div>
        ) : (
          /* All other slides — dots + Back / Next / Done */
          <div className="flex items-center justify-between px-5 pb-5">
            {/* Step dots (exclude intro step 0) */}
            <div className="flex items-center gap-1.5">
              {STEPS.slice(1).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i + 1)}
                  className={`rounded-full transition-all ${
                    i + 1 === step
                      ? 'w-4 h-2 bg-indigo-500'
                      : 'w-2 h-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Back / Next / Done */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              {step < total - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(s => s + 1)}
                  className="px-4 py-1.5 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
                >
                  Next
                </button>
              ) : onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-1.5 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
