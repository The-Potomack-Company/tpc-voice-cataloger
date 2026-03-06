import { useState, useEffect } from "react";
import { RecordButton } from "../components/RecordButton";
import { RecordingIndicator } from "../components/RecordingIndicator";
import { RecordingToast } from "../components/RecordingToast";
import { db } from "../db";

export function NewSessionPage() {
  // Phase 2 demo: create an orphan HouseVisitItem for recording
  // Phase 3 will restructure this into proper session flow
  const [demoItemId, setDemoItemId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    db.houseVisitItems
      .add({
        sessionId: 0,
        sortOrder: 0,
        createdAt: new Date(),
      })
      .then((id) => {
        if (!cancelled) setDemoItemId(id as number);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        New Session
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        Choose a cataloging mode to get started.
      </p>
      <div className="grid gap-4 portrait:grid-cols-1 landscape:grid-cols-2">
        {/* House Visit card */}
        <button
          type="button"
          className="flex items-start gap-4 p-5 rounded-xl border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-800 min-h-[80px] w-full text-left
                     hover:border-accent dark:hover:border-accent transition-colors"
        >
          <svg
            className="w-8 h-8 text-accent shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
            />
          </svg>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              House Visit
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Catalog items with photos during a house visit
            </p>
          </div>
        </button>

        {/* Sale Cataloging card */}
        <button
          type="button"
          className="flex items-start gap-4 p-5 rounded-xl border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-800 min-h-[80px] w-full text-left
                     hover:border-accent dark:hover:border-accent transition-colors"
        >
          <svg
            className="w-8 h-8 text-accent shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
            />
          </svg>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Sale Cataloging
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter receipt numbers and dictate items for a sale
            </p>
          </div>
        </button>
      </div>

      {/* Quick Record section */}
      <div className="mt-8">
        <div className="border-t border-gray-200 dark:border-gray-700 mb-6" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 text-center">
          Quick Record
        </h2>
        <div className="flex justify-center">
          {demoItemId !== null && (
            <RecordButton itemId={demoItemId} itemType="house" />
          )}
        </div>
      </div>

      {/* Recording overlays */}
      <RecordingIndicator />
      <RecordingToast />
    </div>
  );
}
