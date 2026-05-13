import { useState, useRef, useCallback, useEffect } from "react";
import { Icon } from "../ui/icons";

interface SessionSearchProps {
  onSearch: (query: string) => void;
}

/**
 * Mockup-faithful search affordance — token-driven chrome (tpc-search-affordance)
 * with leading search glyph, transparent input, and trailing filter glyph
 * (or clear button when a query is entered).
 */
export function SessionSearch({ onSearch }: SessionSearchProps) {
  const [value, setValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSearch = useCallback(
    (query: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch(query);
      }, 200);
    },
    [onSearch],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setValue(q);
    debouncedSearch(q);
  };

  const handleClear = () => {
    setValue("");
    onSearch("");
  };

  return (
    <div className="tpc-search-affordance">
      <Icon name="search" size={14} aria-hidden style={{ color: "var(--ink-3)" }} />
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder="Search sessions…"
        aria-label="Search sessions"
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-3)",
            padding: 2,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Icon name="x" size={14} aria-hidden />
        </button>
      ) : (
        <Icon name="filter" size={14} aria-hidden style={{ color: "var(--ink-3)" }} />
      )}
    </div>
  );
}
