import React from 'react';
import type { UpdateInfo, UpdateProgress, UpdateStatus } from '../../types';

interface UpdateViewProps {
  updateInfo: UpdateInfo;
  status: UpdateStatus;
  progress: UpdateProgress;
  error: string | null;
  onUpdateNow: () => void;
  onUpdateOnExit: () => void;
  onDismissError: () => void;
}

export const UpdateView: React.FC<UpdateViewProps> = ({
  updateInfo,
  status,
  progress,
  error,
  onUpdateNow,
  onUpdateOnExit,
  onDismissError,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-border-dark rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
        
        <div className="p-4 border-b border-border-dark">
          <h2 className="text-lg font-semibold text-white">
            Update Available
          </h2>
          <p className="text-sm text-white/60 mt-1">
            Version {updateInfo.version} is available
            (current: {updateInfo.current_version})
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {status === 'available' && (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="text-sm text-white/80 whitespace-pre-wrap">
                {updateInfo.release_notes || 'No release notes available.'}
              </div>
            </div>
          )}

          {(status === 'downloading') && (
            <div className="space-y-3">
              <p className="text-sm text-white/80">Downloading update...</p>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <p className="text-xs text-white/50 text-right">
                {progress.percentage}%
                {progress.total > 0 && (
                  <> — {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}</>
                )}
              </p>
            </div>
          )}

          {status === 'installing' && (
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              <p className="text-sm text-white/80">Installing update and restarting...</p>
            </div>
          )}

          {status === 'scheduled' && (
            <div className="space-y-2">
              <p className="text-sm text-green-400">
                ✓ Update downloaded. It will be installed when you close the app.
              </p>
            </div>
          )}

          {status === 'error' && error && (
            <div className="space-y-3">
              <p className="text-sm text-red-400">Update failed: {error}</p>
              <button
                onClick={onDismissError}
                className="text-sm text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {(status === 'available' || status === 'error') && (
          <div className="p-4 border-t border-border-dark flex justify-end gap-3">
            <button
              onClick={onUpdateOnExit}
              className="px-4 py-2 text-sm text-white/70 hover:text-white border
                border-border-dark rounded-md hover:bg-white/5 transition-colors"
              data-testid="update-on-exit-btn"
            >
              Update on Exit
            </button>
            <button
              onClick={onUpdateNow}
              className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90
                rounded-md transition-colors"
              data-testid="update-now-btn"
            >
              Update Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
