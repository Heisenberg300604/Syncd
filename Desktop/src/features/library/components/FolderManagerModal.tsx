import React, { useState } from 'react';
import { Folder, FolderPlus, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { useToastStore } from '../../../stores/useToastStore';

interface FolderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FolderManagerModal: React.FC<FolderManagerModalProps> = ({ isOpen, onClose }) => {
  const { folders, addFolder, removeFolder, startScan, isScanning } = useLibraryStore();
  const { addToast } = useToastStore();
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; path: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handlePickFolder = async () => {
    try {
      setIsAdding(true);
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Music Folder to Index',
      });

      if (selected && typeof selected === 'string') {
        await addFolder(selected);
        addToast({
          type: 'success',
          title: 'Folder Added',
          message: `Indexed "${selected}" and started scanning.`,
        });
      }
    } catch (err: unknown) {
      console.error('Failed to select folder:', err);
      addToast({
        type: 'error',
        title: 'Failed to Add Folder',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!folderToDelete) return;
    try {
      await removeFolder(folderToDelete.id);
      addToast({
        type: 'info',
        title: 'Folder Removed',
        message: `Removed "${folderToDelete.path}" from library.`,
      });
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Failed to Remove Folder',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setFolderToDelete(null);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Music Folders"
        description="SyncD scans these folders recursively for lossless and high-resolution audio files."
        maxWidth="lg"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Indexed Directories ({folders.length})
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => startScan()}
                disabled={isScanning || folders.length === 0}
                title="Rescan all indexed directories"
                className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-amber-400 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-500' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handlePickFolder}
                disabled={isAdding}
                title="Add music folder"
                className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {folders.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center bg-zinc-900/40">
              <Folder className="w-10 h-10 text-zinc-600 mb-2" />
              <p className="text-sm font-medium text-zinc-300">No music folders added yet</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                Add your local music directory to index your tracks, albums, and artists.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePickFolder}
                className="mt-4 text-xs px-4 py-2 h-auto inline-flex items-center justify-center gap-2 shadow-xs"
              >
                <FolderPlus className="w-3.5 h-3.5 shrink-0" />
                <span>Select Folder</span>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-3 bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700/80 rounded-lg group transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 text-amber-400">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-medium text-zinc-200 truncate" title={folder.path}>
                        {folder.path}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                        <span>{folder.trackCount} tracks</span>
                        <span>•</span>
                        <span>
                          {folder.lastScanned
                            ? `Last scanned ${new Date(folder.lastScanned).toLocaleDateString()}`
                            : 'Pending scan'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setFolderToDelete({ id: folder.id, path: folder.path })}
                    title="Remove folder from library"
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-lg text-xs text-zinc-400">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Supported formats: MP3, FLAC, WAV, M4A, AAC, ALAC, OGG, OPUS, AIFF. Embedded ID3 tags and album cover art are read automatically without altering audio files.
            </span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(folderToDelete)}
        onClose={() => setFolderToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Music Folder?"
        description={`This will remove "${folderToDelete?.path}" and its tracks from your library database. Your original audio files on disk will NOT be touched or deleted.`}
        confirmLabel="Remove Folder"
        isDestructive
      />
    </>
  );
};

