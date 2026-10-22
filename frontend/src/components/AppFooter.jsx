import { APP_VERSION, APP_UPDATED } from '../version.js';

export default function AppFooter({ className = '' }) {
  return (
    <footer className={`pt-8 text-xs text-mid-500 flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <span>© {new Date().getFullYear()} Agri Monitor · Mitch Agri Supply</span>
      <span>
        <span className="font-semibold text-green-dark">Version {APP_VERSION}</span>
        <span> · Revision {APP_VERSION - 1} · Updated {APP_UPDATED}</span>
      </span>
    </footer>
  );
}
