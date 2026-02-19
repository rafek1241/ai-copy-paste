import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import type { UpdateInfo, UpdateProgress, UpdateStatus } from '../types';

interface UseUpdateCheckResult {
  updateInfo: UpdateInfo | null;
  status: UpdateStatus;
  progress: UpdateProgress;
  error: string | null;
  updateNow: () => Promise<void>;
  updateOnExit: () => Promise<void>;
  dismissError: () => void;
}

export function useUpdateCheck(): UseUpdateCheckResult {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [status, setStatus] = useState<UpdateStatus>('checking');
  const [progress, setProgress] = useState<UpdateProgress>({ downloaded: 0, total: 0, percentage: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkUpdate() {
      try {
        setStatus('checking');
        const info = await invoke<UpdateInfo>('check_for_updates');
        
        if (cancelled) return;
        
        if (info.update_available) {
          setUpdateInfo(info);
          setStatus('available');
        } else {
          setStatus('idle');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Update check failed:', err);
        setStatus('idle');
      }
    }

    checkUpdate();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    listen<UpdateProgress>('update-download-progress', (event) => {
      setProgress(event.payload);
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  const updateNow = useCallback(async () => {
    if (!updateInfo) return;

    try {
      setStatus('downloading');

      if (updateInfo.is_portable) {
        await invoke('download_update', {
          url: updateInfo.download_url,
          version: updateInfo.version,
        });
        setStatus('installing');
        await invoke('install_portable_update');
      } else {
        const update = await check();
        if (update) {
          await update.downloadAndInstall((event) => {
            if (event.event === 'Started') {
              setProgress({ downloaded: 0, total: event.data.contentLength ?? 0, percentage: 0 });
            } else if (event.event === 'Progress') {
              setProgress((prev) => {
                const downloaded = prev.downloaded + (event.data.chunkLength ?? 0);
                const percentage = prev.total > 0 ? Math.round((downloaded / prev.total) * 100) : 0;
                return { downloaded, total: prev.total, percentage };
              });
            } else if (event.event === 'Finished') {
              setProgress((prev) => ({ ...prev, percentage: 100 }));
            }
          });
          setStatus('installing');
          await relaunch();
        }
      }
    } catch (err) {
      console.error('Update failed:', err);
      setError(String(err));
      setStatus('error');
    }
  }, [updateInfo]);

  const updateOnExit = useCallback(async () => {
    if (!updateInfo) return;

    try {
      if (updateInfo.is_portable) {
        setStatus('downloading');
        await invoke('download_update', {
          url: updateInfo.download_url,
          version: updateInfo.version,
        });
      } else {
        const update = await check();
        if (update) {
          await update.download((event) => {
            if (event.event === 'Started') {
              setProgress({ downloaded: 0, total: event.data.contentLength ?? 0, percentage: 0 });
            } else if (event.event === 'Progress') {
              setProgress((prev) => {
                const downloaded = prev.downloaded + (event.data.chunkLength ?? 0);
                const percentage = prev.total > 0 ? Math.round((downloaded / prev.total) * 100) : 0;
                return { downloaded, total: prev.total, percentage };
              });
            }
          });
          await update.install();
        }
      }
      setStatus('scheduled');
    } catch (err) {
      console.error('Update scheduling failed:', err);
      setError(String(err));
      setStatus('error');
    }
  }, [updateInfo]);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus('available');
  }, []);

  return {
    updateInfo,
    status,
    progress,
    error,
    updateNow,
    updateOnExit,
    dismissError,
  };
}
