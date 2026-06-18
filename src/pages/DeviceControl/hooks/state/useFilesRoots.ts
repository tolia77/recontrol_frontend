import { useCallback, useEffect, useState } from "react";
import type { FileEntry, FilesListRootsResponse } from "src/pages/DeviceControl/services/files/filesProtocol.generated";
import { FilesChannelError } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import type { UseFilesChannel } from "src/pages/DeviceControl/hooks/realtime/useFilesChannel";

export interface UseFilesRootsReturn {
  roots: FileEntry[] | null;
  isLoading: boolean;
  error: FilesChannelError | null;
  /**
   * True when `roots` has been loaded and is a non-null, empty array.
   * Drives the empty-state (no allowlisted roots).
   */
  isEmpty: boolean;
  refetch: () => void;
}

/**
 * Fetch the allowlisted roots once per connected channel. Exposes a
 * `refetch` trigger so the sidebar can refresh without tearing the panel down.
 */
export function useFilesRoots(channel: UseFilesChannel): UseFilesRootsReturn {
  const [roots, setRoots] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState<FilesChannelError | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const request = channel.request;
    if (!request) {
      setRoots(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setRoots(null);
    request<Record<string, never>, FilesListRootsResponse>(
      "files.listRoots",
      {},
    )
      .then((res) => {
        if (cancelled) return;
        setRoots(res.roots);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof FilesChannelError) {
          setError(err);
        } else {
          setError(
            new FilesChannelError({
              code: "INTERNAL_ERROR",
              message: (err as Error)?.message ?? "Unknown error",
            }),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [channel.request, nonce]);

  const isLoading =
    roots === null && error === null && channel.request !== null;
  const isEmpty = roots !== null && roots.length === 0;

  return { roots, isLoading, error, isEmpty, refetch };
}
