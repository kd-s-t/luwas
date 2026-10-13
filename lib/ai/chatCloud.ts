import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import type { ChatThread } from "@/lib/ai/chatTypes";
import type { GeminiAssistModelId } from "@/lib/ai/geminiModels";
import { DEFAULT_GEMINI_MODEL, isGeminiAssistModel } from "@/lib/ai/geminiModels";
import { titleFromMessages } from "@/lib/ai/chatHistory";

const META_ID = "meta";

function threadsCol(db: Firestore, uid: string) {
  return collection(db, "users", uid, "mangluluwasThreads");
}

function metaRef(db: Firestore, uid: string) {
  return doc(db, "users", uid, "mangluluwasThreads", META_ID);
}

/** Drop heavy flood footprints before cloud write (same as localStorage). */
function slimResultForStorage(
  result: ChatThread["result"],
): ChatThread["result"] {
  if (!result) return null;
  const floods = result.predictedFloods;
  if (!floods?.length) return result;
  return {
    ...result,
    predictedFloods: floods.map((f) => ({
      ...f,
      footprints: undefined,
      footprint: undefined,
    })),
  };
}

function slimThread(t: ChatThread): ChatThread {
  return {
    ...t,
    messages: t.messages.slice(-80),
    result: slimResultForStorage(t.result),
  };
}

export async function loadCloudHistory(
  db: Firestore,
  uid: string,
): Promise<{
  activeId: string;
  threads: ChatThread[];
  model: GeminiAssistModelId;
} | null> {
  try {
    const snap = await getDocs(threadsCol(db, uid));
    const threads: ChatThread[] = [];
    let metaActiveId = "";
    let metaModel = DEFAULT_GEMINI_MODEL;

    for (const d of snap.docs) {
      if (d.id === META_ID) {
        const data = d.data() as {
          activeId?: string;
          model?: string;
        };
        if (typeof data.activeId === "string") metaActiveId = data.activeId;
        if (typeof data.model === "string" && isGeminiAssistModel(data.model)) {
          metaModel = data.model;
        }
        continue;
      }
      const t = d.data() as ChatThread;
      if (!t || typeof t.id !== "string" || !Array.isArray(t.messages)) continue;
      threads.push({
        ...t,
        id: t.id || d.id,
        title: t.title || titleFromMessages(t.messages),
        result: t.result ?? null,
        callListVisible: t.callListVisible ?? Boolean(t.result?.actions?.length),
        createdAt: t.createdAt ?? new Date().toISOString(),
        updatedAt: t.updatedAt ?? t.createdAt ?? new Date().toISOString(),
      });
    }

    if (!threads.length) return null;
    threads.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const activeId = threads.some((t) => t.id === metaActiveId)
      ? metaActiveId
      : threads[0]!.id;
    return { activeId, threads, model: metaModel };
  } catch (err) {
    console.warn("[chatCloud] load failed", err);
    return null;
  }
}

export async function saveCloudHistory(
  db: Firestore,
  uid: string,
  state: {
    activeId: string;
    threads: ChatThread[];
    model: GeminiAssistModelId;
  },
): Promise<void> {
  const threads = state.threads.slice(0, 40).map(slimThread);
  const keep = new Set(threads.map((t) => t.id));
  keep.add(META_ID);

  await setDoc(
    metaRef(db, uid),
    {
      activeId: state.activeId,
      model: state.model,
      updatedAt: new Date().toISOString(),
      kind: "meta",
    },
    { merge: true },
  );

  await Promise.all(
    threads.map((t) =>
      setDoc(doc(threadsCol(db, uid), t.id), slimThread(t), { merge: true }),
    ),
  );

  // Drop cloud threads removed locally (best-effort).
  try {
    const snap = await getDocs(threadsCol(db, uid));
    await Promise.all(
      snap.docs
        .filter((d) => !keep.has(d.id))
        .map((d) => deleteDoc(d.ref)),
    );
  } catch {
    /* ignore cleanup races */
  }
}

export async function deleteCloudThread(
  db: Firestore,
  uid: string,
  threadId: string,
): Promise<void> {
  try {
    await deleteDoc(doc(threadsCol(db, uid), threadId));
  } catch (err) {
    console.warn("[chatCloud] delete failed", err);
  }
}
