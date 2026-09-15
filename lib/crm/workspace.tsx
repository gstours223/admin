import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { emptyWorkspace, isWorkspaceEmpty } from "./defaults";
import {
  allocateRefs,
  applyRestore,
  deleteRecord,
  getWorkspace,
  loadSample,
  previewRestore,
  saveMeta,
  saveSettings,
  upsertRecord,
  type RestorePreview,
} from "./server";
import type {
  BackupFile,
  BookingRecord,
  CompanyRecord,
  ContactRecord,
  EntityName,
  InvoiceRecord,
  MetaRecord,
  QueryRecord,
  SettingsRecord,
  VendorRecord,
  Workspace,
} from "./types";

type Status = "loading" | "ready" | "error";

type CrmContextValue = {
  status: Status;
  error: string | null;
  empty: boolean;
  data: Workspace;
  reload: () => Promise<void>;
  saveEntity: <T extends { id: string }>(entity: EntityName, record: T) => Promise<boolean>;
  removeEntity: (entity: EntityName, id: string) => Promise<boolean>;
  patchSettings: (next: SettingsRecord) => Promise<boolean>;
  patchMeta: (next: MetaRecord) => Promise<boolean>;
  nextRef: (kind: "query" | "booking" | "invoice") => Promise<string | null>;
  loadDemo: () => Promise<boolean>;
  restoreFile: (backup: BackupFile) => Promise<boolean>;
  previewFile: (backup: BackupFile) => Promise<RestorePreview | null>;
  actor: string;
};

const CrmContext = createContext<CrmContextValue | null>(null);

function replaceIn<T extends { id: string }>(list: T[], record: T) {
  const idx = list.findIndex((x) => x.id === record.id);
  if (idx === -1) return [record, ...list];
  const copy = list.slice();
  copy[idx] = record;
  return copy;
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const actor = user?.displayName || user?.primaryEmail || "You";
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Workspace>(emptyWorkspace());

  const reload = useCallback(async () => {
    const res = await getWorkspace();
    if (!res.ok) {
      setError(res.error);
      setStatus("error");
      return;
    }
    setData(res.data);
    setError(null);
    setStatus("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void getWorkspace().then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setStatus("error");
        return;
      }
      setData(res.data);
      setError(null);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const saveEntity = useCallback(
    async <T extends { id: string }>(entity: EntityName, record: T) => {
      const stamped = { ...record, updatedBy: actor };
      const currentList = data[entity] as { id: string; updatedAt?: string }[];
      const existing = currentList.find((x) => x.id === record.id);
      const res = await upsertRecord({
        data: {
          entity,
          record: stamped as { id: string },
          expectedUpdatedAt: existing?.updatedAt ?? null,
        },
      });
      if (!res.ok && res.conflict) {
        toast.error("This record changed since you opened it. Reload to see the latest, or save again to overwrite.");
        setData((d) => ({
          ...d,
          [entity]: replaceIn(d[entity] as { id: string }[], res.current as { id: string }),
        }));
        return false;
      }
      if (!res.ok) {
        toast.error(res.error || "Save failed.");
        return false;
      }
      const saved = res.record as { id: string };
      setData((d) => ({
        ...d,
        [entity]: replaceIn(d[entity] as { id: string }[], saved),
      }));
      return true;
    },
    [actor, data],
  );

  const removeEntity = useCallback(async (entity: EntityName, id: string) => {
    const res = await deleteRecord({ data: { entity, id } });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setData((d) => ({
      ...d,
      [entity]: (d[entity] as { id: string }[]).filter((x) => x.id !== id),
    }));
    toast.success("Deleted.");
    return true;
  }, []);

  const patchSettings = useCallback(async (next: SettingsRecord) => {
    const res = await saveSettings({ data: next });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setData((d) => ({ ...d, settings: next }));
    toast.success("Settings saved.");
    return true;
  }, []);

  const patchMeta = useCallback(async (next: MetaRecord) => {
    const res = await saveMeta({ data: next });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setData((d) => ({ ...d, meta: next }));
    return true;
  }, []);

  const nextRef = useCallback(async (kind: "query" | "booking" | "invoice") => {
    const res = await allocateRefs({ data: { kind } });
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    if (res.meta) setData((d) => ({ ...d, meta: res.meta! }));
    if (res.nextNumber) {
      setData((d) => ({ ...d, settings: { ...d.settings, nextNumber: res.nextNumber! } }));
    }
    return res.ref;
  }, []);

  const loadDemo = useCallback(async () => {
    const res = await loadSample();
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    await reload();
    toast.success("Sample Den Haag workspace loaded.");
    return true;
  }, [reload]);

  const restoreFile = useCallback(
    async (backup: BackupFile) => {
      const res = await applyRestore({ data: backup });
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      await reload();
      toast.success("Restore finished. Existing records not in the file were left untouched.");
      return true;
    },
    [reload],
  );

  const previewFile = useCallback(async (backup: BackupFile) => {
    const res = await previewRestore({ data: backup });
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    return res.preview;
  }, []);

  const empty = status === "ready" && isWorkspaceEmpty(data);

  const value = useMemo<CrmContextValue>(
    () => ({
      status,
      error,
      empty,
      data,
      reload,
      saveEntity,
      removeEntity,
      patchSettings,
      patchMeta,
      nextRef,
      loadDemo,
      restoreFile,
      previewFile,
      actor,
    }),
    [
      status,
      error,
      empty,
      data,
      reload,
      saveEntity,
      removeEntity,
      patchSettings,
      patchMeta,
      nextRef,
      loadDemo,
      restoreFile,
      previewFile,
      actor,
    ],
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
  return ctx;
}

export type {
  BookingRecord,
  CompanyRecord,
  ContactRecord,
  InvoiceRecord,
  QueryRecord,
  VendorRecord,
};
