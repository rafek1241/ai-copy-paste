import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";

interface DragDropPayload {
  paths: string[];
  position?: { x: number; y: number };
}

interface UseDragDropIndexerOptions {
  onIndexed?: (path: string) => void;
  onIndexError?: (path: string, error: unknown) => void;
}

export function useDragDropIndexer({
  onIndexed,
  onIndexError,
}: UseDragDropIndexerOptions = {}) {
  const [dragActive, setDragActive] = useState(false);
  const onIndexedRef = useRef(onIndexed);
  const onIndexErrorRef = useRef(onIndexError);

  useEffect(() => {
    onIndexedRef.current = onIndexed;
  }, [onIndexed]);

  useEffect(() => {
    onIndexErrorRef.current = onIndexError;
  }, [onIndexError]);

  useEffect(() => {
    let unlistenDragEnter: UnlistenFn | undefined;
    let unlistenDragLeave: UnlistenFn | undefined;
    let unlistenDragDrop: UnlistenFn | undefined;
    const indexingInProgressRef = { current: false };
    let mounted = true;

    const setup = async () => {
      const dragEnterUnlisten = await listen("tauri://drag-enter", () => {
        setDragActive(true);
      });
      if (!mounted) {
        dragEnterUnlisten();
        return;
      }
      unlistenDragEnter = dragEnterUnlisten;

      const dragLeaveUnlisten = await listen("tauri://drag-leave", () => {
        setDragActive(false);
      });
      if (!mounted) {
        dragLeaveUnlisten();
        return;
      }
      unlistenDragLeave = dragLeaveUnlisten;

      const dragDropUnlisten = await listen<DragDropPayload>(
        "tauri://drag-drop",
        async (event) => {
          setDragActive(false);

          if (indexingInProgressRef.current) {
            return;
          }

          indexingInProgressRef.current = true;

          try {
            const droppedPaths = event.payload?.paths ?? [];
            for (const path of droppedPaths) {
              try {
                await invoke("index_folder", { path });
                await emit("refresh-file-tree");
                onIndexedRef.current?.(path);
              } catch (error) {
                console.error(`Failed to index dropped path ${path}:`, error);
                onIndexErrorRef.current?.(path, error);
              }
            }
          } finally {
            indexingInProgressRef.current = false;
          }
        }
      );
      if (!mounted) {
        dragDropUnlisten();
        return;
      }
      unlistenDragDrop = dragDropUnlisten;
    };

    setup();

    return () => {
      mounted = false;
      unlistenDragEnter?.();
      unlistenDragLeave?.();
      unlistenDragDrop?.();
    };
  }, []);

  return {
    dragActive,
  };
}
