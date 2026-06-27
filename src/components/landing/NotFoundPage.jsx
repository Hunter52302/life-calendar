import { Link, useOutletContext } from 'react-router-dom';

export default function NotFoundPage() {
  const { onEnter } = useOutletContext();
  return (
    <section className="max-w-3xl mx-auto px-5 py-28 text-center">
      <p className="text-5xl font-extrabold text-indigo-500">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-3 text-gray-600 dark:text-gray-400">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link to="/" className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors">
          Back to home
        </Link>
        <button type="button" onClick={onEnter} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
          Log in / Sign up
        </button>
      </div>
    </section>
  );
}
