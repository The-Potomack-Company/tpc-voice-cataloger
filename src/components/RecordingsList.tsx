import { useState, useRef, useCallback, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { formatDuration } from "../utils/audio";
import { getDexieItemId } from "../db/idMapping";

interface RecordingsListProps {
  itemId: string;
}

export function RecordingsList({ itemId }: RecordingsListProps) {
  // ID mapping for migrated items
  const [dexieItemId, setDexieItemId] = useState<number | string | null>(null);
  useEffect(() => {
    getDexieItemId(itemId).then(id => setDexieItemId(id ?? itemId));
  }, [itemId]);

  const recordings = useLiveQuery(
    () => {
      if (dexieItemId == null) return [];
      return db.audio.where("itemId").equals(dexieItemId).sortBy("createdAt");
    },
    [dexieItemId],
    [],
  );

  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const handlePlay = async (id: number) => {
    cleanup();

    if (playingId === id) return; // was playing, now stopped

    const record = await db.audio.get(id);
    if (!record) return;

    const url = URL.createObjectURL(record.blob);
    urlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = cleanup;
    audio.play();
    setPlayingId(id);
  };

  if (recordings.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Recordings ({recordings.length})
      </p>
      {recordings.map((rec, i) => (
        <button
          key={rec.id}
          type="button"
          onClick={() => handlePlay(rec.id!)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                     bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                     hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
        >
          {/* Play/Stop icon */}
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-accent/10 text-accent shrink-0">
            {playingId === rec.id ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h4v12H6zm8 0h4v12h-4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Recording {i + 1}
            </span>
          </div>

          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
            {formatDuration(rec.durationMs ?? 0)}
          </span>
        </button>
      ))}
    </div>
  );
}
