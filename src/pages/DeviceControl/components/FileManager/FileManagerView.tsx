import type { MouseEvent, RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { UseFilesChannel } from "src/pages/DeviceControl/hooks/realtime/useFilesChannel";
import type { useFileManagerSelection } from "src/pages/DeviceControl/hooks/state/useFileManagerSelection";
import type { useFilesRoots } from "src/pages/DeviceControl/hooks/state/useFilesRoots";
import type { SortColumn, SortState } from "./types";
import type { FileEntry } from "src/pages/DeviceControl/services/files/filesProtocol.generated";
import type { TransferQueue } from "src/pages/DeviceControl/services/transfer/TransferQueue";
import FileManagerSidebar from "./FileManagerSidebar";
import FileManagerToolbar from "./FileManagerToolbar";
import FileManagerBreadcrumb from "./FileManagerBreadcrumb";
import FileManagerListing from "./FileManagerListing";
import FileManagerStatusBar from "./FileManagerStatusBar";
import TransferQueuePanel from "./TransferQueuePanel";
import DropZoneOverlay from "./DropZoneOverlay";

// Grouped-prop sub-interfaces

export interface BrowseProps {
  currentPath: string | null;
  sort: SortState;
  onToggleSort: (col: SortColumn) => void;
  refreshKey: number;
  showHidden: boolean;
  onToggleShowHidden: (v: boolean) => void;
}

export interface EditingProps {
  newFolderPending: boolean;
  renamingPath: string | null;
  onNewFolderCommit: (name: string) => void;
  onNewFolderCancel: () => void;
  onRenameCommit: (path: string, newName: string) => void;
  onRenameCancel: () => void;
  onRenameArm: (path: string) => void;
}

export interface MenuProps {
  onRowContextMenu: (e: MouseEvent, entry: FileEntry) => void;
  onEmptyContextMenu: (e: MouseEvent) => void;
}

export interface TransferViewProps {
  queue: TransferQueue;
  disconnectMessage: string | null;
  onDismissDisconnect: () => void;
}

// Top-level props

interface FileManagerViewProps {
  channel: UseFilesChannel;
  roots: ReturnType<typeof useFilesRoots>;
  selection: ReturnType<typeof useFileManagerSelection>;
  rightColumnRef: RefObject<HTMLDivElement | null>;
  dragActive: boolean;
  activeRootPath: string | null;
  visibleEntries: FileEntry[];
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onRefresh: () => void;
  onNewFolder: () => void;
  onRequestRename: () => void;
  onRequestDelete: () => void;
  onMoveTo: () => void;
  onCopyTo: () => void;
  onUploadFiles: (files: File[]) => void;
  onActivate: (entry: FileEntry) => void;
  onSelectRoot: (path: string) => void;
  onNavigate: (path: string | null) => void;
  onVisibleEntriesChange: (entries: FileEntry[]) => void;
  browse: BrowseProps;
  editing: EditingProps;
  menu: MenuProps;
  transfer: TransferViewProps;
  /** Mobile: when true, sidebar and drag-drop are suppressed; rows use touch sizing. */
  isMobile?: boolean;
  /** Mobile: called when a row's kebab button is tapped. */
  onRowKebabClick?: (rect: DOMRect, entry: FileEntry) => void;
}

// Presentational component. Renders ONLY the browsing chrome:
//   sidebar / right-column ref div / toolbar / breadcrumb / listing /
//   status bar / transfer-queue panel / drop-zone overlay.
//
// NO dialogs and NO context menu — those stay in the container.

function FileManagerView({
  channel,
  roots,
  selection,
  rightColumnRef,
  dragActive,
  activeRootPath,
  visibleEntries,
  onRefresh,
  onNewFolder,
  onRequestRename,
  onRequestDelete,
  onMoveTo,
  onCopyTo,
  onUploadFiles,
  onActivate,
  onSelectRoot,
  onNavigate,
  onVisibleEntriesChange,
  browse,
  editing,
  menu,
  transfer,
  isMobile,
  onRowKebabClick,
}: FileManagerViewProps) {
  const { t } = useTranslation("fileManager");

  return (
    <>
      {/* Sidebar suppressed on mobile */}
      {!isMobile && (
        <FileManagerSidebar
          roots={roots.roots}
          isLoading={roots.isLoading}
          error={roots.error ? t("sidebar.couldNotLoadSharedFolders") : null}
          currentPath={browse.currentPath}
          onSelectRoot={onSelectRoot}
        />
      )}
      <div
        ref={rightColumnRef}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <FileManagerToolbar
          showHidden={browse.showHidden}
          onToggleShowHidden={browse.onToggleShowHidden}
          onRefresh={onRefresh}
          disabled={browse.currentPath === null}
          onNewFolder={onNewFolder}
          onRename={onRequestRename}
          selectionCount={selection.state.selected.size}
          onDelete={onRequestDelete}
          onMoveTo={onMoveTo}
          onCopyTo={onCopyTo}
          onUploadFiles={onUploadFiles}
          isMobile={isMobile}
          roots={roots.roots}
          activeRootPath={activeRootPath}
          onSelectRoot={onSelectRoot}
        />
        <FileManagerBreadcrumb
          currentPath={browse.currentPath}
          rootPath={activeRootPath}
          onNavigate={onNavigate}
          isMobile={isMobile}
        />
        <FileManagerListing
          channel={channel}
          path={browse.currentPath}
          sort={browse.sort}
          onToggleSort={browse.onToggleSort}
          refreshKey={browse.refreshKey}
          showHidden={browse.showHidden}
          selection={selection}
          onVisibleEntriesChange={onVisibleEntriesChange}
          onActivate={onActivate}
          newFolderPending={editing.newFolderPending}
          onNewFolderCommit={editing.onNewFolderCommit}
          onNewFolderCancel={editing.onNewFolderCancel}
          renamingPath={editing.renamingPath}
          onRenameCommit={editing.onRenameCommit}
          onRenameCancel={editing.onRenameCancel}
          onRowContextMenu={menu.onRowContextMenu}
          onEmptyContextMenu={menu.onEmptyContextMenu}
          onRenameArm={editing.onRenameArm}
          isMobile={isMobile}
          onRowKebabClick={onRowKebabClick}
        />
        <FileManagerStatusBar
          totalCount={visibleEntries.length}
          selectionCount={selection.state.selected.size}
          selectionSize={selection.selectedSize}
        />
        <TransferQueuePanel
          queue={transfer.queue}
          disconnectMessage={transfer.disconnectMessage}
          onDismissDisconnect={transfer.onDismissDisconnect}
        />
        {/* Drag-drop overlay suppressed on mobile */}
        {dragActive && !isMobile && <DropZoneOverlay />}
      </div>
    </>
  );
}

export default FileManagerView;
