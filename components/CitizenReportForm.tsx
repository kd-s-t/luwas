"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  House,
  Loader2,
  LocateFixed,
  Mic,
  Plus,
  Search,
  Shield,
  Square,
  Upload,
} from "lucide-react";
import {
  CitizenFooter,
  CitizenHeader,
  Danger911Banner,
  HomeFloodTip,
  StaySafeCard,
  StepProgress,
} from "@/components/citizen/CitizenChrome";
import { CitizenReportsList } from "@/components/CitizenReportsList";
import {
  easeOut,
  FadeIn,
  FadeItem,
  Stagger,
  useMotionSafe,
} from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { sanitizeGuestReporterPhone } from "@/lib/auth/demoAccount";
import { isCitizen, isOfficer, type UserProfile } from "@/lib/auth/types";
import { t } from "@/lib/citizen/i18n";
import { useCitizenLanguage } from "@/lib/citizen/languagePreference";
import { getClientAuth } from "@/lib/firebase/client";
import {
  captureReportMeta,
  isMobileClient,
  type ReportCaptureMeta,
} from "@/lib/reports/captureMeta";
import {
  createGuestHazardReport,
  createHazardReport,
  markReportValidating,
  newGuestReportId,
  startIncidentDraft,
  updateGuestHazardReport,
  updateIncidentDraft,
  updateReportValidation,
} from "@/lib/reports/api";
import { triggerAutoResponderCall } from "@/lib/alerts/autoResponderCall";
import {
  DEFAULT_REPORT_BARANGAY,
  DEFAULT_REPORT_LGU,
  placeFromCoords,
} from "@/lib/reports/barangayScope";
import { syncHazardReportToBigQuery } from "@/lib/reports/bigquerySync";
import { inferHazard, parseHazardHint } from "@/lib/reports/inferHazard";
import {
  hazardHintLabel,
  refineReportTitle,
  type HazardReport,
  type ReportHazardHint,
} from "@/lib/reports/types";
import { saveGuestReportId } from "@/lib/reports/guestReportStore";
import { takePendingReportMedia } from "@/lib/reports/pendingMedia";
import { isStockReportMediaUrl } from "@/lib/reports/stockMedia";
import {
  compressReportImage,
  fileToBase64,
  uploadReportMedia,
} from "@/lib/reports/upload";
import {
  distanceKm,
  filterPlaces,
  matchPlace,
  NANGKA_HALL,
  nearestPlace,
  placeLabel,
  type ServiceAreaPlace,
} from "@/lib/reports/serviceAreaPlaces";
import { cn } from "@/lib/utils";

const stepMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const HallPinMap = dynamic(() => import("@/components/HallPinMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
      Loading map…
    </div>
  ),
});

type Step = "intent" | "situation" | "location" | "review";

type FieldErrors = {
  situation?: string;
  photos?: string;
  place?: string;
  mobile?: string;
};

/** PH mobile UI: static +639 + up to 10 more digits. */
const PH_MOBILE_PREFIX = "+639";
const PH_MOBILE_LOCAL_LEN = 10;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Digits after the leading 9 of a PH mobile (09… / +639… / 9…). */
function phMobileLocalFromStored(phone: string | null | undefined): string {
  const d = digitsOnly(phone ?? "");
  if (!d) return "";
  if (d.startsWith("639") && d.length >= 3) {
    return d.slice(3, 3 + PH_MOBILE_LOCAL_LEN);
  }
  if (d.startsWith("09") && d.length >= 2) {
    return d.slice(2, 2 + PH_MOBILE_LOCAL_LEN);
  }
  if (d.startsWith("9") && d.length >= 1) {
    return d.slice(1, 1 + PH_MOBILE_LOCAL_LEN);
  }
  return d.slice(0, PH_MOBILE_LOCAL_LEN);
}

function formatPhMobile(localDigits: string): string {
  return `${PH_MOBILE_PREFIX}${localDigits}`;
}

type Intent = "needHelp" | "reportHazard";
type ReportFor = "myself" | "someoneElse";

type CitizenReportFormProps = {
  /** Null/undefined = guest (no login), same as iOS. */
  author?: UserProfile | null;
  /** Open draft / edit from `/report-incident/[id]`. */
  draft?: HazardReport | null;
  /** Update a submitted guest report saved on this device. */
  editMode?: boolean;
};

type PhotoItem = { id: string; file: File; preview: string };

/** Some pickers (iOS/desktop) omit MIME; accept by extension too. */
function isReportMediaFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/") || mime.startsWith("video/")) return true;
  if (mime) return false;
  return /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|mp4|mov|webm|m4v)$/i.test(
    file.name,
  );
}

function authorPlace(profile: UserProfile | null | undefined): string {
  if (!profile) return "no login";
  if (isCitizen(profile)) return profile.purok;
  if (isOfficer(profile)) return profile.orgName;
  return "Field";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function reviewHazardLabel(hint: ReportHazardHint): string {
  if (hint === "flood") return "Flooding";
  return hazardHintLabel(hint);
}

function titleFromSituation(
  situation: string,
  intent: Intent,
  reportFor: ReportFor,
): string {
  const line = situation.trim().split(/\n/)[0]?.trim() ?? "";
  if (line.length >= 8) return line.slice(0, 80);
  if (intent === "needHelp") {
    return reportFor === "someoneElse"
      ? "Someone else needs help"
      : "I need help";
  }
  return reportFor === "someoneElse"
    ? "Hazard report for someone else"
    : "Hazard report";
}

function SolidAction({
  title,
  icon,
  style,
  onClick,
  disabled,
}: {
  title: string;
  icon?: ReactNode;
  style: "danger" | "dark" | "outline";
  onClick: () => void;
  disabled?: boolean;
}) {
  const motionSafe = useMotionSafe();
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={motionSafe && !disabled ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-[16px] text-[17px] font-semibold disabled:opacity-60",
        style === "danger" &&
          "bg-[var(--danger)] text-white shadow-[0_3px_8px_rgba(199,41,41,0.18)] hover:bg-[var(--danger)]/92",
        style === "dark" &&
          "bg-[var(--foreground)] text-white hover:bg-[var(--foreground)]/90",
        style === "outline" &&
          "border-[1.5px] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
      )}
    >
      {icon}
      <span>{title}</span>
    </motion.button>
  );
}

export function CitizenReportForm({
  author = null,
  draft = null,
  editMode = false,
}: CitizenReportFormProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const motionSafe = useMotionSafe();
  const isGuest = !author;
  const [language, setLanguage] = useCitizenLanguage();
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
  const [step, setStep] = useState<Step>(() => {
    if (editMode && draft) return "situation";
    if (!draft || draft.status !== "draft") return "intent";
    return draft.draftStep ?? "situation";
  });
  const [intent, setIntent] = useState<Intent>(
    () => draft?.draftIntent ?? "needHelp",
  );
  const [reportFor, setReportFor] = useState<ReportFor>(
    () => draft?.draftReportFor ?? "myself",
  );
  const [situation, setSituation] = useState(() => {
    if (!draft?.notes) return "";
    return draft.notes
      .split("\n")
      .filter(
        (line) =>
          !line.startsWith("Intent:") &&
          !line.startsWith("Report for:") &&
          !line.startsWith("Status:") &&
          !line.startsWith("Landmark:") &&
          !line.startsWith("Voice:") &&
          !line.startsWith("Transcript:") &&
          line !== "Approximate location",
      )
      .join("\n")
      .trim();
  });
  const [voiceNoteLabel, setVoiceNoteLabel] = useState<string | null>(
    () => draft?.voiceNoteLabel ?? null,
  );
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(
    () => draft?.voiceUrl ?? null,
  );
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(
    () => draft?.voiceTranscript ?? null,
  );
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);
  /** Blob/file still settling — hide play until the browser can load it. */
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceAudioReady, setVoiceAudioReady] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [existingMediaUrl] = useState(() => draft?.mediaUrl ?? null);
  const [existingMediaPath] = useState(() => draft?.mediaPath ?? null);
  const [existingMediaMime] = useState(() => draft?.mediaMime ?? null);
  const [existingMediaType] = useState(() => draft?.mediaType ?? null);
  const [placeQuery, setPlaceQuery] = useState(
    () => draft?.locationLabel?.trim() || "Brgy. Nangka, Consolacion",
  );
  const [lat, setLat] = useState<number>(
    () => draft?.lat ?? NANGKA_HALL.lat,
  );
  const [lng, setLng] = useState<number>(
    () => draft?.lng ?? NANGKA_HALL.lng,
  );
  const [mapZoom, setMapZoom] = useState(15);
  const [landmark, setLandmark] = useState("");
  const [approximate, setApproximate] = useState(true);
  const [fromGps, setFromGps] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mobileLocal, setMobileLocal] = useState(() => {
    const raw = isCitizen(author)
      ? author.phone || ""
      : sanitizeGuestReporterPhone(draft?.reporterPhone) || "";
    return phMobileLocalFromStored(raw);
  });
  const mobileNumber = mobileLocal
    ? formatPhMobile(mobileLocal)
    : "";
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReportCaptureMeta | null>(null);
  const [mobileCapture, setMobileCapture] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceKeepRef = useRef(true);
  const gpsAutoForStepRef = useRef(false);
  /** User searched, tapped a place, or moved the map — late auto-GPS must not overwrite. */
  const userPinnedRef = useRef(false);
  const gpsRequestIdRef = useRef(0);
  const coordsRef = useRef<{ lat: number; lng: number }>({
    lat: NANGKA_HALL.lat,
    lng: NANGKA_HALL.lng,
  });
  coordsRef.current = { lat, lng };

  function voiceNoteStamp(): string {
    return new Date().toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function pickAudioMime(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
      "audio/ogg;codecs=opus",
    ];
    return candidates.find((m) => MediaRecorder.isTypeSupported(m));
  }

  function voiceExtForMime(mime: string): string {
    if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a"))
      return "m4a";
    if (mime.includes("ogg")) return "ogg";
    return "webm";
  }

  function buildReportNotes(): string {
    // Voice label + transcript live on dedicated fields; do not duplicate in notes.
    return [
      situation.trim(),
      landmark.trim() ? `Landmark: ${landmark.trim()}` : "",
      approximate ? "Approximate location" : "",
      intent === "needHelp" ? "Intent: I need help" : "Intent: Report a hazard",
      reportFor === "someoneElse"
        ? "Report for: someone else"
        : "Report for: myself",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function transcribeVoiceFile(file: File): Promise<string> {
    setVoiceTranscribing(true);
    try {
      if (file.size > 3.5 * 1024 * 1024) {
        return "";
      }
      const voiceBase64 = await fileToBase64(file);
      const res = await fetch("/api/ai/transcribe-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceBase64,
          voiceMime: file.type || "audio/webm",
          languageHint:
            language === "fil"
              ? "Filipino or English"
              : language === "ceb"
                ? "Cebuano or English"
                : "English, Filipino, or Cebuano",
        }),
      });
      if (!res.ok) return "";
      const data = (await res.json()) as { transcript?: string };
      return typeof data.transcript === "string" ? data.transcript.trim() : "";
    } catch {
      return "";
    } finally {
      setVoiceTranscribing(false);
    }
  }

  function releaseVoiceStream() {
    voiceStreamRef.current?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        /* already stopped */
      }
    });
    voiceStreamRef.current = null;
  }

  const placeHits = useMemo(() => filterPlaces(placeQuery), [placeQuery]);

  const citizenName = author?.displayName ?? t(language, "common.guest");
  const citizenPurok = isCitizen(author)
    ? `${author.purok} · ${t(language, "common.citizen")}`
    : isOfficer(author)
      ? `${author.orgName}${author.officerTitle ? ` · ${author.officerTitle}` : ""}`
      : t(language, "common.demoNoLogin");

  useEffect(() => {
    setMobileCapture(isMobileClient());
    const pending = takePendingReportMedia();
    if (pending) {
      setPhotos([
        {
          id: crypto.randomUUID(),
          file: pending,
          preview: URL.createObjectURL(pending),
        },
      ]);
      setStep("situation");
      setIntent("reportHazard");
    }
  }, []);

  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.preview);
      stopVoiceCapture(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, []);

  useEffect(() => {
    if (!voiceFile) {
      setVoicePreviewUrl(draft?.voiceUrl ?? null);
      setVoiceProcessing(false);
      setVoiceAudioReady(Boolean(draft?.voiceUrl));
      return;
    }
    setVoiceProcessing(true);
    setVoiceAudioReady(false);
    const url = URL.createObjectURL(voiceFile);
    setVoicePreviewUrl(url);

    const probe = new Audio();
    probe.preload = "auto";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setVoiceProcessing(false);
      setVoiceAudioReady(true);
    };
    probe.addEventListener("canplaythrough", finish);
    probe.addEventListener("loadeddata", finish);
    probe.addEventListener("error", finish);
    probe.src = url;
    try {
      probe.load();
    } catch {
      finish();
    }
    const timeout = window.setTimeout(finish, 6000);

    return () => {
      window.clearTimeout(timeout);
      probe.removeEventListener("canplaythrough", finish);
      probe.removeEventListener("loadeddata", finish);
      probe.removeEventListener("error", finish);
      probe.src = "";
      URL.revokeObjectURL(url);
    };
  }, [voiceFile, draft?.voiceUrl]);

  useEffect(() => {
    if (step !== "location") {
      gpsAutoForStepRef.current = false;
      return;
    }
    if (gpsAutoForStepRef.current) return;
    gpsAutoForStepRef.current = true;
    if (userPinnedRef.current) return;
    void captureGps({ force: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto GPS once per location step visit
  }, [step]);

  useEffect(() => {
    if (!draftId) return;
    if (step === "intent") return;
    void updateIncidentDraft(draftId, {
      draftStep: step,
      draftIntent: intent,
      draftReportFor: reportFor,
      notes: buildReportNotes(),
      title: titleFromSituation(situation, intent, reportFor),
      hazardHint: inferHazard(situation, voiceTranscript),
      lat,
      lng,
      locationLabel: placeQuery.trim() || null,
      reporterPhone: mobileNumber.trim() || null,
    }).catch(() => {
      // non-blocking — local wizard still works
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist when the wizard step changes
  }, [draftId, step]);

  async function beginReport(nextIntent: Intent) {
    setError(null);
    setIntent(nextIntent);
    if (draftId) {
      setStep("situation");
      return;
    }
    setStatus(t(language, "common.saving"));
    try {
      const id = await startIncidentDraft({
        author: author ?? null,
        intent: nextIntent,
        reportFor,
      });
      setDraftId(id);
      // Do not saveGuestReportId here — drafts are not trackable yet.
      setStep("situation");
      router.replace(`/report-incident/${encodeURIComponent(id)}`);
    } catch (err) {
      console.error("[ugnai] startIncidentDraft failed", err);
      setError(
        err instanceof Error ? err.message : t(language, "errors.submitFailed"),
      );
      // Local wizard still works if draft create fails (offline / rules).
      setStep("situation");
    } finally {
      setStatus(null);
    }
  }

  function clearSavedVoice() {
    setVoiceNoteLabel(null);
    setVoiceFile(null);
    setVoiceTranscript(null);
    setVoiceTranscribing(false);
    setVoiceProcessing(false);
    setVoiceAudioReady(false);
  }

  function stopVoiceCapture(saveLabel: boolean) {
    voiceKeepRef.current = saveLabel;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        // Flush the current buffer before stop (Chrome/Safari).
        if (typeof recorder.requestData === "function" && recorder.state === "recording") {
          recorder.requestData();
        }
        recorder.stop();
      } catch {
        releaseVoiceStream();
        mediaRecorderRef.current = null;
        setRecording(false);
        if (saveLabel) setVoiceNoteLabel(voiceNoteStamp());
      }
      return;
    }
    releaseVoiceStream();
    mediaRecorderRef.current = null;
    setRecording(false);
    if (saveLabel) setVoiceNoteLabel(voiceNoteStamp());
  }

  function resetDraft() {
    stopVoiceCapture(false);
    clearSavedVoice();
    setSituation("");
    setPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.preview);
      return [];
    });
    setPlaceQuery("Brgy. Nangka, Consolacion");
    setLat(NANGKA_HALL.lat);
    setLng(NANGKA_HALL.lng);
    setMapZoom(15);
    setLandmark("");
    setApproximate(true);
    setFromGps(false);
    userPinnedRef.current = false;
    setError(null);
    setStatus(null);
  }

  function applyMapPoint(nextLat: number, nextLng: number, zoom?: number) {
    const moved =
      Math.abs(nextLat - coordsRef.current.lat) > 1e-5 ||
      Math.abs(nextLng - coordsRef.current.lng) > 1e-5;
    setLat(nextLat);
    setLng(nextLng);
    if (typeof zoom === "number") setMapZoom(zoom);
    if (!moved) return;
    userPinnedRef.current = true;
    setFromGps(false);
    setError(null);
    const nearest = nearestPlace(nextLat, nextLng);
    if (distanceKm({ lat: nextLat, lng: nextLng }, nearest) < 1.2) {
      setPlaceQuery(placeLabel(nearest));
    }
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const picked = Array.from(list).filter(isReportMediaFile);
    if (picked.length === 0) {
      setFieldErrors((prev) => ({
        ...prev,
        photos: t(language, "errors.photoRequired"),
      }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, photos: undefined }));
    setPhotos((prev) => {
      const next = [...prev];
      for (const file of picked) {
        if (next.length >= 3) break;
        next.push({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
        });
      }
      return next;
    });
  }

  function addPhotoFile(file: File) {
    setFieldErrors((prev) => ({ ...prev, photos: undefined }));
    setPhotos((prev) => {
      if (prev.length >= 3) return prev;
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
        },
      ];
    });
  }

  async function addSamplePhoto() {
    if (photos.length >= 3 || sampleLoading) return;
    setSampleLoading(true);
    setError(null);
    try {
      const res = await fetch("/reports/flood-road-chapel.png");
      if (!res.ok) throw new Error("Could not load sample photo");
      const blob = await res.blob();
      const type =
        blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
      addPhotoFile(new File([blob], "flood-road-chapel.png", { type }));
    } catch {
      setError(t(language, "errors.samplePhoto"));
    } finally {
      setSampleLoading(false);
    }
  }

  async function toggleVoiceRecording() {
    if (voiceBusy) return;
    if (recording) {
      stopVoiceCapture(true);
      return;
    }
    // Starting a new take replaces any saved note.
    clearSavedVoice();
    setError(null);
    setVoiceBusy(true);
    try {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError(t(language, "situation.voiceUnsupported"));
        return;
      }
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setError(t(language, "situation.voiceUnsupported"));
        return;
      }

      // Always request mic - never fake a voice note without permission.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      voiceKeepRef.current = true;

      if (typeof MediaRecorder === "undefined") {
        releaseVoiceStream();
        setError(t(language, "situation.voiceUnsupported"));
        return;
      }

      const mime = pickAudioMime();
      let recorder: MediaRecorder;
      try {
        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
      } catch {
        releaseVoiceStream();
        setError(t(language, "situation.voiceUnsupported"));
        return;
      }

      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          voiceChunksRef.current.push(ev.data);
        }
      };
      recorder.onerror = () => {
        releaseVoiceStream();
        mediaRecorderRef.current = null;
        setRecording(false);
        setError(t(language, "situation.voiceDenied"));
      };
      recorder.onstop = () => {
        const chunks = voiceChunksRef.current.slice();
        const mimeType =
          recorder.mimeType || mime || "audio/webm";
        releaseVoiceStream();
        mediaRecorderRef.current = null;
        setRecording(false);
        voiceChunksRef.current = [];
        if (!voiceKeepRef.current) return;
        const label = voiceNoteStamp();
        setVoiceNoteLabel(label);
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          const ext = voiceExtForMime(mimeType);
          const file = new File([blob], `voice-note.${ext}`, {
            type: mimeType.split(";")[0] || "audio/webm",
          });
          setVoiceProcessing(true);
          setVoiceAudioReady(false);
          setVoiceFile(file);
          setVoiceTranscript(null);
          void transcribeVoiceFile(file).then((text) => {
            if (text) setVoiceTranscript(text);
          });
        } else {
          setVoiceFile(null);
          setVoiceTranscript(null);
          setVoiceProcessing(false);
          setVoiceAudioReady(false);
        }
      };

      try {
        recorder.start(250);
      } catch {
        recorder.start();
      }
      setRecording(true);
      setVoiceNoteLabel(null);
      setVoiceFile(null);
      setVoiceTranscript(null);
    } catch (err) {
      releaseVoiceStream();
      mediaRecorderRef.current = null;
      setRecording(false);
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name: string }).name)
          : "";
      setError(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? t(language, "situation.voiceDenied")
          : t(language, "situation.voiceUnsupported"),
      );
    } finally {
      setVoiceBusy(false);
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const hit = prev.find((p) => p.id === id);
      if (hit) URL.revokeObjectURL(hit.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  function selectPlace(p: ServiceAreaPlace) {
    userPinnedRef.current = true;
    setPlaceQuery(placeLabel(p));
    setLat(p.lat);
    setLng(p.lng);
    setMapZoom(15);
    setFromGps(false);
    setError(null);
  }

  async function captureGps(opts?: { force?: boolean }) {
    const force = opts?.force === true;
    const requestId = ++gpsRequestIdRef.current;
    if (force) userPinnedRef.current = false;
    setGpsLoading(true);
    setError(null);
    try {
      const captured = await captureReportMeta();
      if (requestId !== gpsRequestIdRef.current) return;
      // Manual search / map pin wins over a late auto-GPS result.
      if (!force && userPinnedRef.current) return;
      setMeta(captured);
      if (captured.lat != null && captured.lng != null) {
        if (!force && userPinnedRef.current) return;
        setLat(captured.lat);
        setLng(captured.lng);
        setMapZoom(16);
        setFromGps(true);
        userPinnedRef.current = false;
        if (captured.locationLabel) {
          setPlaceQuery(captured.locationLabel);
        } else {
          const nearest = nearestPlace(captured.lat, captured.lng);
          setPlaceQuery(placeLabel(nearest));
        }
        setApproximate(true);
      } else if (force) {
        setError(t(language, "errors.gpsFailed"));
      }
    } catch {
      if (force) setError(t(language, "errors.gpsDenied"));
    } finally {
      if (requestId === gpsRequestIdRef.current) setGpsLoading(false);
    }
  }

  function validateSituation(): boolean {
    const next: FieldErrors = {};
    if (!situation.trim()) {
      next.situation = t(language, "errors.situationRequired");
    }
    const hasPhoto =
      photos.length > 0 || Boolean(editMode && existingMediaUrl);
    if (!hasPhoto) {
      next.photos = t(language, "errors.photoMissing");
    }
    setFieldErrors((prev) => ({
      ...prev,
      situation: next.situation,
      photos: next.photos,
    }));
    return !next.situation && !next.photos;
  }

  function validateLocation(): boolean {
    if (!placeQuery.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        place: t(language, "errors.placeRequired"),
      }));
      return false;
    }
    setFieldErrors((prev) => ({ ...prev, place: undefined }));
    return true;
  }

  function validateMobile(): boolean {
    if (mobileLocal.length !== PH_MOBILE_LOCAL_LEN) {
      setFieldErrors((prev) => ({
        ...prev,
        mobile: t(language, "errors.mobileRequired"),
      }));
      return false;
    }
    setFieldErrors((prev) => ({ ...prev, mobile: undefined }));
    return true;
  }

  async function submitGuestReport(file: File | null) {
    setStatus(
      t(language, editMode ? "common.saving" : "common.submitting"),
    );
    const reportId = draftId ?? newGuestReportId();
    const title = titleFromSituation(situation, intent, reportFor);
    const mediaType = file
      ? file.type.startsWith("video/")
        ? "video"
        : "photo"
      : existingMediaType === "video"
        ? "video"
        : "photo";

    let transcript = voiceTranscript?.trim() || "";
    if (voiceFile && !transcript) {
      transcript = await transcribeVoiceFile(voiceFile);
      if (transcript) setVoiceTranscript(transcript);
    }
    const notes = buildReportNotes();
    const hazardHint = inferHazard(situation, notes, transcript, title);

    const captured = meta ?? (await captureReportMeta().catch(() => null));
    if (captured) setMeta(captured);

    async function uploadGuestFile(
      kind: "photo" | "voice",
      media: File,
    ): Promise<{ mediaPath: string; mediaUrl: string; mediaMime: string } | null> {
      const prepared =
        kind === "photo" ? await compressReportImage(media) : media;
      const body = new FormData();
      body.set("reportId", reportId);
      body.set("kind", kind);
      body.set("file", prepared, prepared.name || `${kind}.bin`);
      const res = await fetch("/api/reports/guest-upload", {
        method: "POST",
        body,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        mediaPath?: string;
        mediaUrl?: string;
        mediaMime?: string;
      };
      if (!data.mediaUrl || !data.mediaPath) return null;
      return {
        mediaPath: data.mediaPath,
        mediaUrl: data.mediaUrl,
        mediaMime: data.mediaMime || prepared.type || "application/octet-stream",
      };
    }

    let uploaded: {
      mediaPath: string;
      mediaUrl: string;
      mediaMime: string;
    };
    if (file) {
      const up = await uploadGuestFile("photo", file);
      if (!up) throw new Error(t(language, "errors.submitFailed"));
      uploaded = up;
    } else if (
      existingMediaUrl &&
      existingMediaPath &&
      !isStockReportMediaUrl(existingMediaUrl)
    ) {
      uploaded = {
        mediaPath: existingMediaPath,
        mediaUrl: existingMediaUrl,
        mediaMime: existingMediaMime || "image/jpeg",
      };
    } else {
      // Photo optional — voice-only / text-only reports are allowed (same as iOS).
      uploaded = { mediaPath: "", mediaUrl: "", mediaMime: "" };
    }

    let voicePath: string | null = draft?.voicePath ?? null;
    let voiceUrl: string | null = draft?.voiceUrl ?? null;
    let voiceMime: string | null = draft?.voiceMime ?? null;
    if (voiceFile) {
      const voiceUploaded = await uploadGuestFile("voice", voiceFile);
      if (voiceUploaded) {
        voicePath = voiceUploaded.mediaPath;
        voiceUrl = voiceUploaded.mediaUrl;
        voiceMime = voiceUploaded.mediaMime;
      }
    }

    const mediaSource = mobileCapture
      ? "mobile-camera"
      : (draft?.mediaSource ?? "desktop-file");
    const payload = {
      id: reportId,
      title,
      notes,
      hazardHint,
      mediaType: mediaType as "photo" | "video",
      mediaPath: uploaded.mediaPath,
      mediaUrl: uploaded.mediaUrl,
      mediaMime: uploaded.mediaMime,
      mediaSource,
      voiceNoteLabel: voiceNoteLabel ?? null,
      voicePath,
      voiceUrl,
      voiceMime,
      voiceTranscript: transcript || null,
      lat,
      lng,
      locationAccuracyM: fromGps
        ? (captured?.locationAccuracyM ?? null)
        : null,
      locationLabel: placeQuery.trim(),
      device: captured?.device ?? "web-ugnai-citizen",
      reporterPhone: mobileNumber.trim() || null,
    };

    const id = editMode
      ? await updateGuestHazardReport(payload)
      : await createGuestHazardReport({ ...payload, status: "queued" });

    // Await Vertex + Gemini so title / hazardHint are rewritten before leave.
    setStatus(t(language, "common.submitting"));
    try {
      await fetch("/api/reports/guest-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id, title, notes, hazardHint }),
      });
    } catch {
      // Report already queued — officer queue can still pick it up.
    }

    saveGuestReportId(id);
    setStatus(null);
    router.push(`/report-incident/received/${encodeURIComponent(id)}`);
  }

  async function submitReport() {
    if (submitting) return;
    if (!validateMobile()) return;
    setError(null);
    setSubmitting(true);
    setStatus(
      t(language, editMode ? "common.saving" : "common.submitting"),
    );

    try {
      const file: File | null = photos[0]?.file ?? null;

      if (isGuest || !author) {
        await submitGuestReport(file);
        return;
      }

      const reportId = draftId ?? crypto.randomUUID();
      const title = titleFromSituation(situation, intent, reportFor);

      let transcript = voiceTranscript?.trim() || "";
      if (voiceFile && !transcript) {
        transcript = await transcribeVoiceFile(voiceFile);
        if (transcript) setVoiceTranscript(transcript);
      }
      const notes = buildReportNotes();
      const hazardHint = inferHazard(situation, notes, transcript, title);

      const captured = meta ?? (await captureReportMeta().catch(() => null));
      if (captured) setMeta(captured);

      const mediaType =
        file && file.type.startsWith("video/") ? "video" : "photo";
      const uploaded = file
        ? await uploadReportMedia({
            citizenUid: author.uid,
            reportId,
            file,
            kind: "photo",
          })
        : editMode &&
            existingMediaUrl &&
            existingMediaPath &&
            !isStockReportMediaUrl(existingMediaUrl)
          ? {
              mediaPath: existingMediaPath,
              mediaUrl: existingMediaUrl,
              mediaMime: existingMediaMime || "image/jpeg",
            }
          : { mediaPath: "", mediaUrl: "", mediaMime: "" };

      let voicePath: string | null = null;
      let voiceUrl: string | null = null;
      let voiceMime: string | null = null;
      if (voiceFile) {
        const voiceUploaded = await uploadReportMedia({
          citizenUid: author.uid,
          reportId,
          file: voiceFile,
          kind: "voice",
        });
        voicePath = voiceUploaded.mediaPath;
        voiceUrl = voiceUploaded.mediaUrl;
        voiceMime = voiceUploaded.mediaMime;
      }

      const mediaSource = mobileCapture ? "mobile-camera" : "desktop-file";
      const reporterPhone =
        mobileNumber.trim() || (isCitizen(author) ? author.phone : null);
      const emailVerified = Boolean(
        getClientAuth().currentUser?.emailVerified || author.idVerified,
      );
      const place =
        placeFromCoords(lat, lng) ?? {
          barangay: DEFAULT_REPORT_BARANGAY,
          lgu: DEFAULT_REPORT_LGU,
        };

      const id = await createHazardReport({
        id: reportId,
        citizenUid: author.uid,
        citizenName: author.displayName,
        citizenPurok: authorPlace(author),
        barangay: place.barangay,
        lgu: place.lgu,
        citizenPhotoURL: author.photoURL ?? null,
        title,
        notes,
        hazardHint,
        mediaType,
        mediaPath: uploaded.mediaPath,
        mediaUrl: uploaded.mediaUrl,
        mediaMime: uploaded.mediaMime,
        mediaSource,
        voiceNoteLabel: voiceNoteLabel ?? null,
        voicePath,
        voiceUrl,
        voiceMime,
        voiceTranscript: transcript || null,
        lat,
        lng,
        locationAccuracyM: fromGps
          ? (captured?.locationAccuracyM ?? null)
          : null,
        locationLabel: placeQuery.trim(),
        device: captured?.device ?? null,
        ipAddress: captured?.ipAddress ?? null,
        reporterIdVerified: Boolean(author.idVerified),
        reporterEmail: author.email,
        reporterPhone,
        reporterEmailVerified: emailVerified,
      });

      await markReportValidating(id);

      const canInline =
        Boolean(file) &&
        mediaType === "photo" &&
        (file?.size ?? 0) <= 3.5 * 1024 * 1024;
      const mediaBase64 =
        canInline && file ? await fileToBase64(file) : undefined;
      const res = await fetch("/api/ai/validate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes,
          hazardHint,
          mediaType,
          mediaMime: uploaded.mediaMime || undefined,
          mediaBase64,
          voiceTranscript: transcript || undefined,
          fileName: file?.name,
        }),
      });

      if (!res.ok) throw new Error(`Validation failed (${res.status})`);

      const data = (await res.json()) as {
        status: "legit" | "rejected" | "needs_review";
        verdict: "legit" | "rejected" | "needs_review";
        confidence: number;
        reason: string;
        source: "gemini" | "local";
        model?: string;
        hazardHint?: ReportHazardHint;
        priority?: "critical" | "high" | "medium" | "low";
        priorityFactors?: {
          immediateSeverity: string;
          peopleAffected: string;
          existingCoverage: string;
          deliveryFeasibility: string;
          evidenceQuality: string;
        };
        vertexClass?: string | null;
        vertexConfidence?: number | null;
        vertexLocationLabel?: string | null;
        vertexLocationConfidence?: number | null;
        vertexLocationPlaceId?: string | null;
        vertexLocationPlaceLabel?: string | null;
      };

      const detectedHint =
        data.hazardHint ||
        parseHazardHint(data.vertexClass) ||
        hazardHint;
      const displayTitle = refineReportTitle(title, detectedHint);
      const validatedAt = new Date().toISOString();
      await updateReportValidation(id, {
        status: data.status,
        aiVerdict: data.verdict,
        aiConfidence: data.confidence,
        aiReason: data.reason,
        aiSource: data.source,
        aiModel: data.model ?? null,
        ...(detectedHint !== hazardHint ? { hazardHint: detectedHint } : {}),
        ...(displayTitle !== title ? { title: displayTitle } : {}),
        aiPriority: data.priority ?? null,
        aiPriorityFactors: data.priorityFactors ?? null,
        vertexClass: data.vertexClass ?? null,
        vertexConfidence:
          typeof data.vertexConfidence === "number"
            ? data.vertexConfidence
            : null,
        vertexLocationLabel: data.vertexLocationLabel ?? null,
        vertexLocationConfidence:
          typeof data.vertexLocationConfidence === "number"
            ? data.vertexLocationConfidence
            : null,
        vertexLocationPlaceId: data.vertexLocationPlaceId ?? null,
        vertexLocationPlaceLabel: data.vertexLocationPlaceLabel ?? null,
        validatedAt,
        trustInput: {
          registered: true,
          idVerified: Boolean(author.idVerified),
          email: author.email,
          phone: reporterPhone,
          emailVerified,
          mediaSource,
          lat,
          lng,
          locationAccuracyM: fromGps
            ? (captured?.locationAccuracyM ?? null)
            : null,
          vertexClass: data.vertexClass ?? null,
          vertexConfidence:
            typeof data.vertexConfidence === "number"
              ? data.vertexConfidence
              : null,
          vertexLocationPlaceId: data.vertexLocationPlaceId ?? null,
          vertexLocationLabel: data.vertexLocationLabel ?? null,
          vertexLocationConfidence:
            typeof data.vertexLocationConfidence === "number"
              ? data.vertexLocationConfidence
              : null,
        },
      });

      syncHazardReportToBigQuery({
        id,
        citizenUid: author.uid,
        citizenName: author.displayName || "Citizen",
        citizenPurok: authorPlace(author),
        barangay: place.barangay,
        lgu: place.lgu,
        title: displayTitle,
        notes,
        hazardHint: detectedHint,
        mediaType,
        mediaPath: uploaded.mediaPath,
        mediaUrl: uploaded.mediaUrl,
        status: data.status,
        aiVerdict: data.verdict,
        aiConfidence: data.confidence,
        aiSource: data.source,
        aiModel: data.model ?? null,
        vertexClass: data.vertexClass ?? null,
        vertexConfidence:
          typeof data.vertexConfidence === "number"
            ? data.vertexConfidence
            : null,
        lat,
        lng,
        trustScore: null,
        validatedAt,
        createdAt: validatedAt,
      });

      if (data.status === "legit") {
        void triggerAutoResponderCall({
          id,
          hazardHint: detectedHint,
          status: "legit",
          barangay: place.barangay,
          lgu: place.lgu,
          lat,
          lng,
          title: displayTitle,
          notes,
          citizenPurok: authorPlace(author),
          autoResponderCallAt: null,
          voiceTranscript: transcript || null,
          aiReason: data.reason,
        });
      }

      saveGuestReportId(id);
      setStatus(null);
      router.push(`/report-incident/received/${encodeURIComponent(id)}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t(language, "errors.submitFailed"),
      );
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  const wizardHeader = (
    <CitizenHeader
      language={language}
      onLanguageChange={setLanguage}
      variant="brand"
      showBack
      onBack={() => {
        setError(null);
        if (recording) stopVoiceCapture(false);
        if (step === "situation") {
          if (editMode && draftId) {
            router.push(
              `/track-report?ref=${encodeURIComponent(draftId)}`,
            );
          } else if (draftId) router.push("/report-incident");
          else setStep("intent");
        } else if (step === "location") setStep("situation");
        else if (step === "review") setStep("location");
      }}
    />
  );

  function formatPhotoSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (step === "intent") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <CitizenHeader
          language={language}
          onLanguageChange={setLanguage}
          variant="brand"
        />
      <Stagger className="space-y-5 pt-3 pb-4">
        <FadeItem>
          <div className="space-y-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-[#1d4ed8] uppercase">
              <Shield className="size-3.5 fill-[#1d4ed8] text-[#1d4ed8]" aria-hidden />
              {t(language, "home.badge")}
            </p>
            <h1 className="text-[30px] leading-[1.15] font-bold tracking-tight text-[var(--foreground)]">
              {t(language, "home.tagline")}
            </h1>
            <p className="text-[15px] leading-relaxed text-[var(--muted)]">
              {t(language, "home.blurb")}
            </p>
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white"
                aria-hidden
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              {t(language, "home.noLoginNeeded")}
            </p>
            {!isGuest ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {citizenName}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{citizenPurok}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-[var(--danger)]"
                  onClick={() => void logout()}
                >
                  {t(language, "common.logOut")}
                </button>
              </div>
            ) : null}
          </div>
        </FadeItem>

        <FadeItem>
          <div className="space-y-3">
            <p className="text-base font-semibold text-[var(--foreground)]">
              {t(language, "home.whatToDo")}
            </p>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--muted)]">
                {t(language, "home.reportFor")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "min-h-11 rounded-[12px] border-[1.5px] px-3 text-sm font-semibold transition",
                    reportFor === "myself"
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
                  )}
                  onClick={() => setReportFor("myself")}
                >
                  {t(language, "home.forMyself")}
                </button>
                <button
                  type="button"
                  className={cn(
                    "min-h-11 rounded-[12px] border-[1.5px] px-3 text-sm font-semibold transition",
                    reportFor === "someoneElse"
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
                  )}
                  onClick={() => setReportFor("someoneElse")}
                >
                  {t(language, "home.forSomeoneElse")}
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-[var(--danger)]/20 bg-[#fce8ea] p-3">
              <SolidAction
                title={t(language, "home.needHelp")}
                style="danger"
                icon={
                  <AlertTriangle
                    className="size-[18px] fill-white text-white"
                    aria-hidden
                  />
                }
                onClick={() => void beginReport("needHelp")}
              />
              <p className="px-1 text-sm text-[var(--muted)]">
                {t(language, "home.needHelpHint")}
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <SolidAction
                title={t(language, "home.reportHazard")}
                style="outline"
                icon={<AlertTriangle className="size-[18px]" aria-hidden />}
                onClick={() => void beginReport("reportHazard")}
              />
              <p className="px-1 text-sm text-[var(--muted)]">
                {t(language, "home.reportHazardHint")}
              </p>
            </div>

            <div className="space-y-2">
              <SolidAction
                title={t(language, "home.checkReport")}
                style="outline"
                icon={<Search className="size-[18px]" aria-hidden />}
                onClick={() => {
                  router.push("/track-report");
                }}
              />
              <p className="px-1 text-sm text-[var(--muted)]">
                {t(language, "home.checkReportHint")}
              </p>
            </div>
          </div>
        </FadeItem>

        <FadeItem>
          <HomeFloodTip language={language} />
        </FadeItem>
        <FadeItem>
          <Danger911Banner language={language} variant="soft" />
        </FadeItem>

        {isCitizen(author) ? (
          <FadeItem>
            <div id="my-reports" className="pt-2">
              <CitizenReportsList citizenUid={author.uid} />
            </div>
          </FadeItem>
        ) : null}
      </Stagger>
        <CitizenFooter language={language} tight />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {wizardHeader}

      <AnimatePresence mode="wait" initial={false}>
      {step === "situation" ? (
        <motion.div
          key="situation"
          className="space-y-5 pt-4"
          variants={stepMotion}
          initial={motionSafe ? "initial" : false}
          animate="animate"
          exit={motionSafe ? "exit" : undefined}
          transition={{ duration: 0.32, ease: easeOut }}
        >
          <StepProgress
            step={1}
            title={t(language, "step.situation")}
            language={language}
            variant="brand"
          />

          <div className="space-y-1.5">
            <h2 className="text-[28px] leading-[1.15] font-bold tracking-tight text-[var(--foreground)]">
              {t(language, "situation.title")}
            </h2>
            <p className="text-[15px] leading-relaxed text-[var(--muted)]">
              {t(language, "situation.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--danger)]/20 bg-[#fce8ea] px-3.5 py-3">
            <AlertTriangle
              className="size-4 shrink-0 text-[var(--danger)]"
              aria-hidden
            />
            <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--foreground)]">
              {intent === "needHelp"
                ? t(language, "intent.needHelp")
                : t(language, "intent.reportHazard")}
            </p>
            <button
              type="button"
              className="shrink-0 text-sm font-semibold text-[#2563eb]"
              onClick={() => {
                if (draftId) router.push("/report-incident");
                else setStep("intent");
              }}
            >
              {t(language, "common.change")}
            </button>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {t(language, "situation.whatHappening")}
            </span>
            <textarea
              rows={4}
              required
              value={situation}
              placeholder={t(language, "situation.example")}
              onChange={(e) => {
                setSituation(e.target.value);
                setFieldErrors((prev) => ({ ...prev, situation: undefined }));
              }}
              className={cn(
                "w-full resize-y rounded-xl border bg-[var(--surface)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)]",
                fieldErrors.situation
                  ? "border-[var(--danger)]"
                  : "border-[var(--border)] focus:border-[#2563eb]/40",
              )}
            />
            {fieldErrors.situation ? (
              <span className="block text-xs text-[var(--danger)]" role="alert">
                {fieldErrors.situation}
              </span>
            ) : null}
            <span className="block text-xs leading-relaxed text-[var(--muted)]">
              {t(language, "situation.typeOrVoice")}
            </span>
          </label>

          {voiceFile && voicePreviewUrl && !recording ? (
            <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {voiceProcessing
                      ? t(language, "situation.voiceProcessing")
                      : t(language, "situation.voiceReady")}
                  </p>
                  <p className="truncate font-mono text-[10px] text-[var(--muted)]">
                    {voiceNoteLabel ?? voiceFile.name}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={voiceBusy || voiceProcessing || voiceTranscribing}
                  className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                  onClick={() => void toggleVoiceRecording()}
                >
                  {t(language, "situation.voiceReRecord")}
                </button>
              </div>
              {voiceProcessing ? (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 text-sm text-[var(--muted)]">
                  <Loader2
                    className="size-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  {t(language, "situation.voiceProcessing")}
                </div>
              ) : (
                <audio
                  key={voicePreviewUrl}
                  controls
                  src={voicePreviewUrl}
                  className="w-full"
                  preload="auto"
                  onCanPlay={() => setVoiceAudioReady(true)}
                >
                  {t(language, "situation.voicePlay")}
                </audio>
              )}
              {voiceTranscribing ? (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-[var(--muted)]">
                  <Loader2
                    className="size-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  {t(language, "situation.voiceTranscribing")}
                </div>
              ) : voiceTranscript ? (
                <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm leading-relaxed">
                  <span className="block font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                    Transcript
                  </span>
                  {voiceTranscript}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                disabled={voiceBusy}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] bg-[var(--surface)] px-3 py-3.5 text-sm font-semibold disabled:opacity-60",
                  recording
                    ? "border-[var(--danger)] text-[var(--danger)]"
                    : "border-[var(--border)]",
                )}
                onClick={() => void toggleVoiceRecording()}
              >
                {voiceBusy && !recording ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : recording ? (
                  <Square className="size-3.5 fill-current" aria-hidden />
                ) : (
                  <Mic className="size-4" aria-hidden />
                )}
                {recording
                  ? t(language, "situation.recording")
                  : t(language, "situation.recordVoice")}
              </button>
              {!recording ? (
                <p className="text-xs text-[var(--muted)]">
                  {t(language, "situation.recordHint")}
                </p>
              ) : null}
            </div>
          )}

          <div className="space-y-2.5">
            <p className="text-sm font-semibold">
              {t(language, "situation.addPhoto")}
            </p>
            {editMode && existingMediaUrl && photos.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={existingMediaUrl}
                  alt=""
                  className="size-12 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {existingMediaPath?.split("/").pop() || "Current photo"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Keep this photo, or add a new one below.
                  </p>
                </div>
              </div>
            ) : null}
            <AnimatePresence initial={false}>
              {photos.map((p) => (
                <motion.div
                  key={p.id}
                  layout={motionSafe}
                  initial={motionSafe ? { opacity: 0, y: 8, scale: 0.98 } : false}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    motionSafe
                      ? { opacity: 0, height: 0, marginTop: 0 }
                      : undefined
                  }
                  transition={{ duration: 0.25, ease: easeOut }}
                  className="flex items-center gap-2.5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm"
                >
                  {p.file.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.preview}
                      alt=""
                      className="size-12 rounded-lg object-cover"
                    />
                  ) : (
                    <video
                      src={p.preview}
                      className="size-12 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.file.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {t(language, "situation.photoMeta", {
                        count: String(photos.length),
                        size: formatPhotoSize(p.file.size),
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-[var(--muted)]"
                    aria-label={t(language, "common.removePhoto")}
                    onClick={() => removePhoto(p.id)}
                  >
                    ×
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {photos.length < 3 ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif"
                  multiple
                  {...(mobileCapture
                    ? { capture: "environment" as const }
                    : {})}
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-3 py-3.5 text-sm font-semibold"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" aria-hidden />
                  {photos.length === 0
                    ? t(language, "situation.addPhotoButton")
                    : t(language, "situation.addAnotherPhoto")}
                </button>
              </>
            ) : null}
            {fieldErrors.photos ? (
              <p className="text-xs text-[var(--danger)]" role="alert">
                {fieldErrors.photos}
              </p>
            ) : null}
            <p className="text-xs text-[var(--muted)]">
              {t(language, "situation.photoHint")}
            </p>
          </div>

          <div className="flex gap-2.5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-3.5 py-3">
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold text-white"
              aria-hidden
            >
              i
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {t(language, "situation.aiTitle")}
              </p>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                {t(language, "situation.aiNote")}
              </p>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-xl bg-[#1e3a5f] px-4 py-[16px] text-[17px] font-semibold text-white transition hover:bg-[#1e3a5f]/92"
              onClick={() => {
                if (validateSituation()) setStep("location");
              }}
            >
              {t(language, "situation.nextLocation")}
            </button>
            <button
              type="button"
              className="mx-auto block text-sm font-semibold text-[#2563eb]"
              onClick={() => {
                if (validateSituation()) setStep("location");
              }}
            >
              {t(language, "situation.continuePartial")}
            </button>
            <p className="text-center text-xs text-[var(--muted)]">
              {t(language, "situation.missingOk")}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t(language, "situation.startKnowTitle")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              {t(language, "situation.startKnowBody")}
            </p>
          </div>

          <Danger911Banner language={language} variant="soft" />

          <p className="text-center text-xs leading-relaxed text-[var(--muted)]">
            {t(language, "situation.noAccountNote")}
          </p>
        </motion.div>
      ) : null}

      {step === "location" ? (
        <motion.div
          key="location"
          className="space-y-5 pt-4"
          variants={stepMotion}
          initial={motionSafe ? "initial" : false}
          animate="animate"
          exit={motionSafe ? "exit" : undefined}
          transition={{ duration: 0.32, ease: easeOut }}
        >
          <StepProgress
            step={2}
            title={t(language, "step.location")}
            language={language}
            variant="brand"
          />

          <div className="space-y-1.5">
            <h2 className="text-[28px] leading-[1.15] font-bold tracking-tight text-[var(--foreground)]">
              {t(language, "location.title")}
            </h2>
            <p className="text-[15px] leading-relaxed text-[var(--muted)]">
              {t(language, "location.subtitle")}
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={gpsLoading}
              onClick={() => void captureGps({ force: true })}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] bg-[var(--surface)] px-3 py-3.5 text-sm font-semibold disabled:opacity-60",
                fromGps ? "border-[var(--success)]" : "border-[var(--border)]",
              )}
            >
              {gpsLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <LocateFixed className="size-4" aria-hidden />
              )}
              {gpsLoading
                ? t(language, "location.gettingGps")
                : t(language, "location.useGps")}
            </button>
            <p className="text-xs text-[var(--muted)]">
              {t(language, "location.gpsHint")}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {t(language, "location.searchLabel")}
              </span>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
                  aria-hidden
                />
                <input
                  value={placeQuery}
                  required
                  onChange={(e) => {
                    const next = e.target.value;
                    setPlaceQuery(next);
                    setFromGps(false);
                    userPinnedRef.current = true;
                    setFieldErrors((prev) => ({ ...prev, place: undefined }));
                    const hit = matchPlace(next);
                    if (hit) {
                      setLat(hit.lat);
                      setLng(hit.lng);
                      setMapZoom(15);
                    }
                  }}
                  onBlur={() => {
                    const hit = matchPlace(placeQuery);
                    if (!hit) return;
                    selectPlace(hit);
                  }}
                  placeholder={t(language, "location.searchPlaceholder")}
                  className={cn(
                    "w-full rounded-xl border bg-[var(--surface)] py-3 pr-3 pl-10 text-sm outline-none",
                    fieldErrors.place
                      ? "border-[var(--danger)]"
                      : "border-[var(--border)] focus:border-[#2563eb]/40",
                  )}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              {fieldErrors.place ? (
                <span className="block text-xs text-[var(--danger)]" role="alert">
                  {fieldErrors.place}
                </span>
              ) : null}
            </label>
            {placeHits.length > 0 ? (
              <ul className="space-y-1.5">
                {placeHits.slice(0, 6).map((p) => {
                  const label = placeLabel(p);
                  const selected =
                    matchPlace(placeQuery)?.id === p.id ||
                    placeQuery.trim().toLowerCase() === label.toLowerCase();
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => selectPlace(p)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left",
                          selected
                            ? "border-[#bfdbfe] bg-[#eff6ff]"
                            : "border-[var(--border)] bg-[var(--surface)]",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {label}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {t(language, "location.selectedRegion", {
                              lgu: p.lgu,
                            })}
                          </p>
                        </div>
                        {selected ? (
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white"
                            aria-hidden
                          >
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t(language, "location.adjustPin")}
            </p>
            <div className="relative">
              <HallPinMap
                center={{ lat, lng }}
                zoom={mapZoom}
                className="relative h-[260px] w-full overflow-hidden rounded-[14px] border border-[var(--border)]"
                onChange={({ center, zoom }) =>
                  applyMapPoint(center.lat, center.lng, zoom)
                }
              />
              {fromGps ? (
                <span className="absolute top-2.5 right-2.5 z-[1000] rounded-full bg-[var(--success)] px-2 py-1 text-[10px] font-bold text-white uppercase">
                  GPS
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[var(--muted)]">
              {t(language, "location.mapHint")}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {t(language, "location.pinNear", {
                place: placeQuery.trim() || placeLabel(nearestPlace(lat, lng)),
              })}
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">
              {t(language, "location.landmark")}
            </span>
            <input
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder={t(language, "location.landmarkPlaceholder")}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm outline-none focus:border-[#2563eb]/40"
            />
            <span className="block text-xs text-[var(--muted)]">
              {t(language, "location.landmarkHint")}
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              checked={approximate}
              onChange={(e) => setApproximate(e.target.checked)}
              className="size-4 accent-[#2563eb]"
            />
            <span>{t(language, "location.approximate")}</span>
          </label>

          <div className="flex gap-2.5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-3.5 py-3">
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold text-white"
              aria-hidden
            >
              i
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {t(language, "location.unsureTitle")}
              </p>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                {t(language, "location.unsureBody")}
              </p>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-xl bg-[#1e3a5f] px-4 py-[16px] text-[17px] font-semibold text-white transition hover:bg-[#1e3a5f]/92"
              onClick={() => {
                if (validateLocation()) setStep("review");
              }}
            >
              {t(language, "location.nextReview")}
            </button>
            <button
              type="button"
              className="mx-auto block text-sm font-semibold text-[#2563eb]"
              onClick={() => {
                setApproximate(true);
                setError(null);
                setStep("review");
              }}
            >
              {t(language, "location.continueNoLocation")}
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t(language, "location.noGpsTitle")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              {t(language, "location.noGpsBody")}
            </p>
          </div>

          <Danger911Banner language={language} variant="soft" />

          <p className="text-center text-xs leading-relaxed text-[var(--muted)]">
            {t(language, "situation.noAccountNote")}
          </p>
        </motion.div>
      ) : null}

      {step === "review" ? (
        <motion.div
          key="review"
          className="space-y-5 pt-4"
          variants={stepMotion}
          initial={motionSafe ? "initial" : false}
          animate="animate"
          exit={motionSafe ? "exit" : undefined}
          transition={{ duration: 0.32, ease: easeOut }}
        >
          <StepProgress
            step={3}
            title={t(language, "step.review")}
            language={language}
            variant="brand"
          />

          <div className="space-y-1.5">
            <h2 className="text-[28px] leading-[1.15] font-bold tracking-tight text-[var(--foreground)]">
              {t(language, "review.title")}
            </h2>
            <p className="text-[15px] leading-relaxed text-[var(--muted)]">
              {t(language, "review.subtitle")}
            </p>
          </div>

          <div className="min-w-0 space-y-3">
            <div className="min-w-0 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[var(--foreground)]">
                  {t(language, "review.situation")}
                </p>
                <button
                  type="button"
                  className="text-sm font-semibold text-[#2563eb]"
                  onClick={() => setStep("situation")}
                >
                  {t(language, "common.edit")}
                </button>
              </div>
              <p className="mt-2.5 text-sm font-semibold text-[var(--foreground)]">
                {intent === "needHelp"
                  ? t(language, "intent.needHelp")
                  : t(language, "intent.reportHazard")}
                {" · "}
                {reviewHazardLabel(
                  inferHazard(situation, voiceTranscript),
                )}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                {situation}
              </p>
            </div>

            <div className="flex gap-2.5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-3.5 py-3">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold text-white"
                aria-hidden
              >
                !
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {t(language, "review.aiSuggestion")}
                </p>
                <p className="text-xs leading-relaxed text-[var(--muted)]">
                  {t(language, "review.aiSuggestionBody", {
                    category: reviewHazardLabel(
                      inferHazard(situation, voiceTranscript),
                    ),
                  })}
                </p>
              </div>
            </div>

            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[var(--foreground)]">
                  {t(language, "review.location")}
                </p>
                <button
                  type="button"
                  className="text-sm font-semibold text-[#2563eb]"
                  onClick={() => setStep("location")}
                >
                  {t(language, "common.edit")}
                </button>
              </div>
              <div className="mt-2.5 flex items-start gap-2.5">
                <House
                  className="mt-0.5 size-5 shrink-0 text-[#2563eb]"
                  strokeWidth={2}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {placeQuery.trim() ||
                      placeLabel(nearestPlace(lat, lng))}
                  </p>
                  {landmark ? (
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {landmark}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {t(language, "review.approxPin")}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[var(--foreground)]">
                  {t(language, "review.attachments")}
                </p>
                <button
                  type="button"
                  className="shrink-0 text-sm font-semibold text-[#2563eb]"
                  onClick={() => setStep("situation")}
                >
                  {t(language, "common.edit")}
                </button>
              </div>
              {photos.length > 0 ? (
                <div className="mt-2.5 space-y-2.5">
                  {photos.map((p, i) => (
                    <div key={p.id} className="flex min-w-0 items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.preview}
                        alt=""
                        className="size-12 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">
                          {p.file.name}
                        </p>
                        {i === 0 ? (
                          <p className="text-xs text-[var(--muted)]">
                            {t(language, "review.photoMeta", {
                              count: String(photos.length),
                              size: formatBytes(
                                photos.reduce((sum, x) => sum + x.file.size, 0),
                              ),
                            })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {voiceNoteLabel || voicePreviewUrl ? (
                <div className="mt-2.5 space-y-2">
                  {voiceNoteLabel ? (
                    <p className="truncate text-sm text-[var(--foreground)]">
                      {voiceNoteLabel}
                    </p>
                  ) : null}
                  {voicePreviewUrl ? (
                    <audio
                      controls
                      src={voicePreviewUrl}
                      className="w-full"
                      preload="metadata"
                    >
                      {t(language, "situation.voicePlay")}
                    </audio>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {t(language, "review.noVoice")}
                </p>
              )}
              {voiceTranscribing ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Transcribing voice…
                </p>
              ) : null}
              {voiceTranscript ? (
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                  {voiceTranscript}
                </p>
              ) : null}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {t(language, "review.mobileOptional")}
            </span>
            <div
              className={cn(
                "flex w-full items-center rounded-xl border bg-[var(--surface)] text-sm",
                fieldErrors.mobile
                  ? "border-[var(--danger)]"
                  : "border-[var(--border)] focus-within:border-[#2563eb]/40",
              )}
            >
              <span
                className="shrink-0 select-none pl-3 font-medium text-[var(--muted)]"
                aria-hidden
              >
                {PH_MOBILE_PREFIX}
              </span>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                maxLength={PH_MOBILE_LOCAL_LEN}
                value={mobileLocal}
                onChange={(e) => {
                  setMobileLocal(
                    digitsOnly(e.target.value).slice(0, PH_MOBILE_LOCAL_LEN),
                  );
                  setFieldErrors((prev) => ({ ...prev, mobile: undefined }));
                }}
                placeholder={t(language, "review.mobilePlaceholder")}
                autoComplete="tel-national"
                aria-label={t(language, "review.mobileOptional")}
                className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-2 py-3 outline-none"
              />
            </div>
            {fieldErrors.mobile ? (
              <span className="block text-xs text-[var(--danger)]" role="alert">
                {fieldErrors.mobile}
              </span>
            ) : null}
            <span className="block text-xs leading-relaxed text-[var(--muted)]">
              {t(language, "review.mobileHint")}
            </span>
          </label>

          <div className="flex gap-2.5 rounded-xl border border-[#f0d9a8] bg-[#fff8e8] px-3.5 py-3">
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#8a6a2f] text-[11px] font-bold text-white"
              aria-hidden
            >
              !
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-[#5c4a1f]">
                {t(language, "review.assistTitle")}
              </p>
              <p className="text-xs leading-relaxed text-[#5c4a1f]/90">
                {t(language, "review.assistBody")}
              </p>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          {status ? (
            <p className="text-sm text-[var(--muted)]" role="status">
              {status}
            </p>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              {t(
                language,
                editMode ? "review.saveConsent" : "review.consent",
              )}
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitReport()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--danger)] px-4 py-[16px] text-[17px] font-semibold text-white transition hover:bg-[var(--danger)]/92 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {submitting
                ? t(
                    language,
                    editMode ? "common.saving" : "common.submitting",
                  )
                : t(language, editMode ? "review.save" : "review.submit")}
            </button>
            <p className="text-center text-xs text-[var(--muted)]">
              {t(
                language,
                editMode
                  ? "review.saveEvenMissing"
                  : "review.submitEvenMissing",
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t(language, "review.nextTitle")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              {t(language, "review.nextBody")}
            </p>
          </div>

          <Danger911Banner language={language} variant="soft" />

          <p className="text-center text-xs leading-relaxed text-[var(--muted)]">
            {t(language, "situation.noAccountNote")}
          </p>
        </motion.div>
      ) : null}
      </AnimatePresence>

      {step === "situation" || step === "location" || step === "review" ? (
        <CitizenFooter language={language} tight />
      ) : null}
    </div>
  );
}
