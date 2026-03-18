import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { reExportSession } from "../utils/export";
import type { Tables } from "../db/database.types";

interface ExportHistoryListProps {
  sessionId: string;
}

export function ExportHistoryList({ sessionId }: ExportHistoryListProps) {
  const [expanded, setExpanded] = useState(false);
  const [exports, setExports] = useState<Tables<"export_history">[]>([]);

  useEffect(() => {
    supabase
      .from("export_history")
      .select("*")
      .eq("session_id", sessionId)
      .order("exported_at", { ascending: false })
      .then(({ data }) => {
        if (data) setExports(data);
      });
  }, [sessionId]);

  if (exports.length === 0) return null;

  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2"
      >
        <svg
          className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Export History ({exports.length})
        </h2>
      </button>
      {expanded && (
        <div className="space-y-2">
          {exports.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2"
            >
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {new Date(record.exported_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                &mdash; {record.item_count} item{record.item_count !== 1 ? "s" : ""}
              </div>
              <button
                type="button"
                onClick={() => reExportSession(sessionId)}
                className="text-xs px-3 py-1 rounded-lg border border-accent text-accent
                           hover:bg-accent/10 transition-colors font-medium"
              >
                Re-export
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
