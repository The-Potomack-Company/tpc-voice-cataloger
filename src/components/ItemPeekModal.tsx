import type { Tables } from "../db/database.types";
import { Button } from "../ui/Button";
import { Icon } from "../ui/icons";

type Item = Tables<"items">;

interface ItemPeekModalProps {
  item: Item | null;
  onClose: () => void;
}

const fields: Array<[keyof Item, string]> = [
  ["receipt_number", "Receipt"],
  ["title", "Title"],
  ["description", "Description"],
  ["condition", "Condition"],
  ["estimate", "Estimate"],
  ["measurements", "Measurements"],
  ["category", "Category"],
];

export function ItemPeekModal({ item, onClose }: ItemPeekModalProps) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-ink/40 px-4 py-8 flex items-end sm:items-center justify-center">
      <div className="w-full max-w-lg rounded-lg bg-bg border border-rule shadow-lg max-h-[85vh] overflow-auto">
        <div className="sticky top-0 bg-bg border-b border-rule px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-ink-3 tpc-mono">Item #{item.sort_order + 1}</p>
            <h2 className="text-base font-semibold text-ink truncate">
              {item.receipt_number ?? item.title ?? "Unlabeled item"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tpc-btn tpc-btn-ghost"
            style={{ padding: 6 }}
            aria-label="Close item preview"
          >
            <Icon name="x" size={16} aria-hidden />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {fields.map(([key, label]) => {
            const value = item[key];
            return (
              <div key={key}>
                <p className="text-xs text-ink-3">{label}</p>
                <p className="text-sm text-ink whitespace-pre-wrap">
                  {typeof value === "string" && value.trim() ? value : "Not captured"}
                </p>
              </div>
            );
          })}
          <Button variant="secondary" fullWidth onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
