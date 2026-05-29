import { useState } from 'react';

const STEPS = [
  {
    intro: true,
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="4" width="28" height="32" rx="4" className="fill-blue-100 dark:fill-blue-900/40" />
        <rect x="6" y="4" width="28" height="9" rx="4" className="fill-blue-500" />
        <rect x="12" y="18" width="3" height="3" rx="1" className="fill-blue-300 dark:fill-blue-600" />
        <rect x="18" y="19" width="10" height="1.5" rx="0.75" className="fill-blue-200 dark:fill-blue-700" />
        <rect x="12" y="24" width="3" height="3" rx="1" className="fill-green-400" />
        <path d="M13 25.5l0.8 0.8 1.4-1.4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="18" y="25" width="8" height="1.5" rx="0.75" className="fill-blue-200 dark:fill-blue-700" />
      </svg>
    ),
    title: 'Welcome to PLS Do It',
    body: (
      <>
        <p className="mb-3">PLS Do It is your day-linked task manager — tasks live on specific dates, roll over automatically if not completed, and stay out of your way when done.</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">This quick tour covers everything you need to hit the ground running. You can always reopen it from <span className="font-medium text-gray-700 dark:text-gray-300">Settings → PLS Do It Tutorial</span>.</p>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="14" className="fill-blue-100 dark:fill-blue-900/40" />
        <circle cx="20" cy="20" r="10" className="fill-blue-500" />
        <path d="M20 13v7l4 2.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="32" cy="10" r="6" className="fill-green-400" />
        <path d="M29.5 10l1.5 1.5 2.5-2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Adding tasks',
    body: (
      <>
        <p className="mb-3">There are two ways to add a task:</p>
        <ul className="space-y-2 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Blue + button</span> — the floating button in the bottom-right corner. Tap it to open a full add form with title, description, priority, due date, and color.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">+ Add task</span> — the inline link under any date section. Lets you add directly into that day.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Enter key</span> — once you've typed a title, press Enter to save instantly. Only the title is required.</li>
        </ul>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="8" width="28" height="7" rx="3" className="fill-gray-100 dark:fill-gray-700" />
        <rect x="6" y="8" width="28" height="7" rx="3" stroke="#D1D5DB" className="dark:stroke-gray-600" strokeWidth="1" />
        <rect x="6" y="18" width="28" height="7" rx="3" className="fill-green-50 dark:fill-green-900/30" />
        <rect x="6" y="18" width="28" height="7" rx="3" stroke="#86EFAC" strokeWidth="1" />
        <circle cx="13" cy="11.5" r="3" className="fill-white dark:fill-gray-800" stroke="#D1D5DB" strokeWidth="1.5" />
        <circle cx="13" cy="21.5" r="3" className="fill-green-500" />
        <path d="M11.5 21.5l1.2 1.2 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="18" y="10" width="12" height="1.5" rx="0.75" className="fill-gray-400 dark:fill-gray-500" />
        <rect x="18" y="20" width="12" height="1.5" rx="0.75" className="fill-gray-300 dark:fill-gray-600" />
      </svg>
    ),
    title: 'Completing tasks',
    body: (
      <>
        <p className="mb-3">Click the circle checkbox on the left of any task to mark it complete — it turns green with a checkmark. Click again to undo.</p>
        <ul className="space-y-1.5 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Completed tasks</span> get a strikethrough and stay visible at the bottom of the list so you can see what you've accomplished today.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Hide/Show</span> — use the "Hide N completed" toggle at the bottom to collapse them when you want a cleaner view. You can also set this to hide automatically in Settings → Appearance.</li>
        </ul>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="10" width="28" height="20" rx="3" className="fill-gray-50 dark:fill-gray-800" stroke="#E5E7EB" className="dark:stroke-gray-700" strokeWidth="1" />
        <rect x="9" y="14" width="22" height="2" rx="1" className="fill-gray-800 dark:fill-gray-200" />
        <rect x="9" y="19" width="18" height="1.5" rx="0.75" className="fill-gray-300 dark:fill-gray-600" />
        <rect x="9" y="23" width="14" height="1.5" rx="0.75" className="fill-gray-300 dark:fill-gray-600" />
        <circle cx="32" cy="13" r="5" className="fill-red-400" />
        <rect x="30" y="12.5" width="4" height="1" rx="0.5" fill="white" />
        <rect x="30" y="14.5" width="4" height="1" rx="0.5" fill="white" />
        <rect x="30" y="16.5" width="2.5" height="1" rx="0.5" fill="white" />
      </svg>
    ),
    title: 'Editing & details',
    body: (
      <>
        <p className="mb-3">Click the task title to expand its detail panel:</p>
        <ul className="space-y-1.5 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Title & description</span> — edit both inline. Press the blue <span className="font-medium">Save</span> button to confirm, or <span className="font-medium">Cancel</span> to discard.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Priority</span> — Low / Medium / High. High tasks show in red in the list column.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Due date</span> — change when the task is scheduled. Moving it forward removes it from today's list.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Color</span> — pick a color swatch to add a left accent bar on the task row.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Notes icon</span> — when a description exists, a document icon appears in the Notes column. Click it for a quick read-only preview.</li>
        </ul>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <rect x="3" y="8" width="10" height="24" rx="3" className="fill-blue-100 dark:fill-blue-900/40" stroke="#93C5FD" strokeWidth="1" />
        <rect x="15" y="8" width="10" height="24" rx="3" className="fill-amber-100 dark:fill-amber-900/30" stroke="#FCD34D" strokeWidth="1" />
        <rect x="27" y="8" width="10" height="24" rx="3" className="fill-green-100 dark:fill-green-900/30" stroke="#86EFAC" strokeWidth="1" />
        <rect x="5" y="14" width="6" height="1.5" rx="0.75" className="fill-blue-400" />
        <rect x="5" y="17" width="4" height="1.5" rx="0.75" className="fill-blue-300" />
        <rect x="17" y="14" width="6" height="1.5" rx="0.75" className="fill-amber-400" />
        <rect x="17" y="17" width="4" height="1.5" rx="0.75" className="fill-amber-300" />
        <rect x="29" y="14" width="6" height="1.5" rx="0.75" className="fill-green-500" />
        <rect x="29" y="17" width="4" height="1.5" rx="0.75" className="fill-green-400" />
        <path d="M3 11.5h10M15 11.5h10M27 11.5h10" stroke="currentColor" strokeWidth="0" />
        <text x="8" y="12" fontSize="4" fill="#3B82F6" fontWeight="600" textAnchor="middle">To Do</text>
        <text x="20" y="12" fontSize="3.5" fill="#D97706" fontWeight="600" textAnchor="middle">In Progress</text>
        <text x="32" y="12" fontSize="4" fill="#16A34A" fontWeight="600" textAnchor="middle">Done</text>
      </svg>
    ),
    title: 'Kanban view',
    body: (
      <>
        <p className="mb-3">Switch to Kanban view from <span className="font-medium text-gray-700 dark:text-gray-300">Settings → Appearance → PLS Do It view</span>. Tasks become cards arranged in three columns:</p>
        <ul className="space-y-1.5 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-blue-600 dark:text-blue-400">To Do</span> — tasks waiting to be started.</li>
          <li><span className="font-semibold text-amber-600 dark:text-amber-400">In Progress</span> — tasks you're actively working on.</li>
          <li><span className="font-semibold text-green-600 dark:text-green-400">Done</span> — completed tasks. Moving a card here marks it complete automatically.</li>
        </ul>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Drag cards between columns or reorder within a column. Use the + button in each column header to add tasks directly there.</p>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="6" width="14" height="14" rx="3" className="fill-amber-100 dark:fill-amber-900/30" stroke="#FCD34D" strokeWidth="1.5" />
        <rect x="20" y="6" width="14" height="14" rx="3" className="fill-blue-100 dark:fill-blue-900/30" stroke="#93C5FD" strokeWidth="1.5" />
        <path d="M20 13H6M20 13l-4-4M20 13l-4 4" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="6" y="24" width="28" height="10" rx="3" className="fill-gray-50 dark:fill-gray-800" stroke="#E5E7EB" strokeWidth="1" />
        <rect x="10" y="27" width="12" height="1.5" rx="0.75" className="fill-gray-400 dark:fill-gray-500" />
        <rect x="10" y="30" width="8" height="1.5" rx="0.75" className="fill-gray-300 dark:fill-gray-600" />
        <circle cx="30" cy="29" r="3" className="fill-amber-400" />
        <path d="M29 29.3l0.8 0.7 1.5-1.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Rollover — never drop a task',
    body: (
      <>
        <p className="mb-3">If you don't complete a pending task by end of day, it <span className="font-semibold text-gray-800 dark:text-gray-200">automatically rolls over</span> to today — no manual rescheduling needed.</p>
        <ul className="space-y-1.5 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-amber-600 dark:text-amber-400">Not completed from before</span> — rolled-over tasks appear in a highlighted section at the top of the list so they're impossible to miss.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Original date preserved</span> — the date you originally planned the task is kept internally for future history features.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Test it</span> — expand any pending task and click the amber "simulate not completed from yesterday" button to see how rollover looks without waiting overnight.</li>
        </ul>
      </>
    ),
  },
];

export default function TodoTutorialModal({ onClose }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const total = STEPS.length;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-cyan-400 to-green-400" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            PLS Do It Tutorial
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-base leading-none"
            aria-label="Close tutorial"
          >✕</button>
        </div>

        {/* Step content */}
        <div className="px-5 pt-3 pb-5 flex flex-col items-center text-center min-h-[300px]">
          <div className="mb-4 mt-1">{current.icon}</div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{current.title}</h2>
          <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed w-full">
            {typeof current.body === 'string' ? <p>{current.body}</p> : current.body}
          </div>
        </div>

        {/* Footer */}
        {current.intro ? (
          <div className="flex items-center justify-center gap-3 px-5 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >Skip</button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-6 py-2 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
            >Let's go</button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-5 pb-5">
            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {STEPS.slice(1).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i + 1)}
                  className={`rounded-full transition-all ${
                    i + 1 === step
                      ? 'w-4 h-2 bg-blue-500'
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
              >Back</button>
              {step < total - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(s => s + 1)}
                  className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
                >Next</button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
                >Done</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
