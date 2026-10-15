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
  Activity,
  AlertTriangle,
  Loader2,
  LocateFixed,
  Mic,
  Plus,
  Search,
  Sparkles,
  Square,
  Upload,
} from "lucide-react";
import {
  CitizenFooter,
  CitizenHeader,
  Danger911Banner,
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
import { DEMO_CITIZENS } from "@/lib/auth/demoAccount";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer, type UserProfile } from "@/lib/auth/types";
import { t, type CitizenLang } from "@/lib/citizen/i18n";
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
  updateIncidentDraft,
  updateReportValidation,
} from "@/lib/reports/api";
import type { HazardReport } from "@/lib/reports/types";
import { triggerAutoResponderCall } from "@/lib/alerts/autoResponderCall";
import {
  DEFAULT_REPORT_BARANGAY,
  DEFAULT_REPORT_LGU,
} from "@/lib/reports/barangayScope";
import { syncHazardReportToBigQuery } from "@/lib/reports/bigquerySync";
import type { ReportHazardHint } from "@/lib/reports/types";
import {
  latestGuestReportId,
  saveGuestReportId,
} from "@/lib/reports/guestReportStore";
import { takePendingReportMedia } from "@/lib/reports/pendingMedia";
import { fileToBase64, uploadReportMedia } from "@/lib/reports/upload";
import {
  distanceKm,
  filterPlaces,
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
type Intent = "needHelp" | "reportHazard";
type ReportFor = "myself" | "someoneElse";

type CitizenReportFormProps = {
  /** Null/undefined = guest (no login), same as iOS. */
  author?: UserProfile | null;
  /** Open draft from `/report-incident/[id]` — resumes the wizard. */
  draft?: HazardReport | null;
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
  if (!profile) return "Demo · no login";
  if (isCitizen(profile)) return profile.purok;
  if (isOfficer(profile)) return profile.orgName;
  return "Field";
}

function inferHazard(situation: string): ReportHazardHint {
  const t = situation.toLowerCase();
  if (/flood|tubig|baha|knee-deep|knee deep/.test(t)) return "flood";
  if (/landslide|land slide|gusaw|dahon/.test(t)) return "landslide";
  if (
    /road.?block|blockage|blocked road|fallen tree|nahulog.*kahoy|debris|washout|impassable|no.?pass|hindi.?makadaan|road closed|access road/.test(
      t,
    )
  )
    return "blockage";
  if (/typhoon|bagyo|hangin|wind|storm/.test(t)) return "typhoon";
  if (/fire|sunog|usok|smoke/.test(t)) return "fire";
  if (
    /crime|hold.?up|holdup|robbery|theft|nakaw|assault|stab|shoot|gunshot|snatch|riot/.test(
      t,
    )
  )
    return "crime";
  if (
    /accident|banggaan|crash|collision|vehicular|hit.?and.?run|road.?crash|car.?accident|motorcycle.?accident/.test(
      t,
    )
  )
    return "accident";
  if (/evac|shelter|evacuation/.test(t)) return "evac";
  return "other";
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
}: CitizenReportFormProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const motionSafe = useMotionSafe();
  const isGuest = !author;
  const [language, setLanguage] = useState<CitizenLang>("en");
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
  const [starting, setStarting] = useState(false);
  const [step, setStep] = useState<Step>(() => {
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
  const [voiceNoteLabel, setVoiceNoteLabel] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
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
  const [mobileNumber, setMobileNumber] = useState(
    isCitizen(author)
      ? author.phone || ""
      : isGuest
        ? (DEMO_CITIZENS[0]?.phone ?? "")
        : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReportCaptureMeta | null>(null);
  const [mobileCapture, setMobileCapture] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  /** Guest last-report id — null until mount (localStorage). */
  const [savedGuestId, setSavedGuestId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceKeepRef = useRef(true);
  const gpsAutoForStepRef = useRef(false);
  const coordsRef = useRef<{ lat: number; lng: number }>({
    lat: NANGKA_HALL.lat,
    lng: NANGKA_HALL.lng,
  });
  coordsRef.current = { lat, lng };

  function voiceNoteStamp(): string {
    return `Voice note · ${new Date().toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
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

  function buildReportNotes(transcript = voiceTranscript): string {
    return [
      situation.trim(),
      landmark.trim() ? `Landmark: ${landmark.trim()}` : "",
      voiceNoteLabel ? `Voice: ${voiceNoteLabel}` : "",
      transcript ? `Transcript: ${transcript}` : "",
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
    setSavedGuestId(latestGuestReportId());
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
      setVoicePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(voiceFile);
    setVoicePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setVoicePreviewUrl(null);
    };
  }, [voiceFile]);

  useEffect(() => {
    if (step !== "location") {
      gpsAutoForStepRef.current = false;
      return;
    }
    if (gpsAutoForStepRef.current) return;
    gpsAutoForStepRef.current = true;
    void captureGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto GPS once per location step visit
  }, [step]);

  useEffect(() => {
    if (!draftId) return;
    if (step === "intent") return;
    void updateIncidentDraft(draftId, {
      draftStep: step,
      draftIntent: intent,
      draftReportFor: reportFor,
      notes: buildReportNotes(voiceTranscript),
      title: titleFromSituation(situation, intent, reportFor),
      hazardHint: inferHazard(situation),
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
    if (starting) return;
    setStarting(true);
    setError(null);
    setIntent(nextIntent);
    try {
      const id = await startIncidentDraft({
        author,
        intent: nextIntent,
        reportFor,
      });
      setDraftId(id);
      saveGuestReportId(id);
      setSavedGuestId(id);
      router.push(`/report-incident/${encodeURIComponent(id)}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t(language, "errors.submitFailed"),
      );
      setStarting(false);
    }
  }

  function clearSavedVoice() {
    setVoiceNoteLabel(null);
    setVoiceFile(null);
    setVoiceTranscript(null);
    setVoiceTranscribing(false);
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
      setError(t(language, "errors.photoRequired"));
      return;
    }
    setError(null);
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
    setError(null);
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
          setVoiceFile(file);
          setVoiceTranscript(null);
          void transcribeVoiceFile(file).then((text) => {
            if (text) setVoiceTranscript(text);
          });
        } else {
          setVoiceFile(null);
          setVoiceTranscript(null);
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
    setPlaceQuery(placeLabel(p));
    setLat(p.lat);
    setLng(p.lng);
    setMapZoom(15);
    setFromGps(false);
    setError(null);
  }

  async function captureGps() {
    setGpsLoading(true);
    setError(null);
    try {
      const captured = await captureReportMeta();
      setMeta(captured);
      if (captured.lat != null && captured.lng != null) {
        setLat(captured.lat);
        setLng(captured.lng);
        setMapZoom(16);
        setFromGps(true);
        if (captured.locationLabel) {
          setPlaceQuery(captured.locationLabel);
        } else {
          const nearest = nearestPlace(captured.lat, captured.lng);
          setPlaceQuery(placeLabel(nearest));
        }
        if (
          typeof captured.locationAccuracyM === "number" &&
          captured.locationAccuracyM > 80
        ) {
          setApproximate(true);
        } else {
          setApproximate(false);
        }
      } else {
        setError(t(language, "errors.gpsFailed"));
      }
    } catch {
      setError(t(language, "errors.gpsDenied"));
    } finally {
      setGpsLoading(false);
    }
  }

  function validateSituation(): boolean {
    if (photos.length < 1) {
      setError(t(language, "errors.photoRequired"));
      return false;
    }
    setError(null);
    return true;
  }

  function validateLocation(): boolean {
    if (!placeQuery.trim()) {
      setError(t(language, "errors.placeRequired"));
      return false;
    }
    setError(null);
    return true;
  }

  async function submitGuestReport(file: File) {
    setStatus(t(language, "common.saving"));
    const reportId = draftId ?? newGuestReportId();
    const hazardHint = inferHazard(situation);
    const title = titleFromSituation(situation, intent, reportFor);
    const mediaType = file.type.startsWith("video/") ? "video" : "photo";

    let transcript = voiceTranscript?.trim() || "";
    if (voiceFile && !transcript) {
      transcript = await transcribeVoiceFile(voiceFile);
      if (transcript) setVoiceTranscript(transcript);
    }
    const notes = buildReportNotes(transcript || null);

    const captured = meta ?? (await captureReportMeta().catch(() => null));
    if (captured) setMeta(captured);

    async function uploadGuestFile(
      kind: "photo" | "voice",
      media: File,
    ): Promise<{ mediaPath: string; mediaUrl: string; mediaMime: string } | null> {
      const body = new FormData();
      body.set("reportId", reportId);
      body.set("kind", kind);
      body.set("file", media, media.name || `${kind}.bin`);
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
        mediaMime: data.mediaMime || media.type || "application/octet-stream",
      };
    }

    const uploaded =
      (await uploadGuestFile("photo", file)) ??
      ({
        mediaPath: "/reports/flood-road-chapel.png",
        mediaUrl: "/reports/flood-road-chapel.png",
        mediaMime: "image/png",
      } as const);

    let voicePath: string | null = null;
    let voiceUrl: string | null = null;
    let voiceMime: string | null = null;
    if (voiceFile) {
      const voiceUploaded = await uploadGuestFile("voice", voiceFile);
      if (voiceUploaded) {
        voicePath = voiceUploaded.mediaPath;
        voiceUrl = voiceUploaded.mediaUrl;
        voiceMime = voiceUploaded.mediaMime;
      }
    }

    const mediaSource = mobileCapture ? "mobile-camera" : "desktop-file";
    const id = await createGuestHazardReport({
      id: reportId,
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
      device: captured?.device ?? "web-luwas-citizen",
      reporterPhone: mobileNumber.trim() || null,
      status: "queued",
    });

    // AI after save — guest update rules allow it without login.
    const canInline =
      mediaType === "photo" && file.size <= 3.5 * 1024 * 1024;
    if (canInline) {
      void (async () => {
        try {
          const mediaBase64 = await fileToBase64(file);
          const res = await fetch("/api/ai/validate-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              notes,
              hazardHint,
              mediaType: "photo",
              mediaMime: uploaded.mediaMime,
              mediaBase64,
              fileName: file.name,
            }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            status: "legit" | "rejected" | "needs_review";
            verdict: "legit" | "rejected" | "needs_review";
            confidence: number;
            reason: string;
            source: "gemini" | "local";
            model?: string;
            vertexClass?: string | null;
            vertexConfidence?: number | null;
          };
          const status =
            data.verdict === "rejected"
              ? "rejected"
              : data.verdict === "needs_review"
                ? "needs_review"
                : "queued";
          await updateReportValidation(id, {
            status,
            aiVerdict: data.verdict,
            aiConfidence: data.confidence,
            aiReason: data.reason,
            aiSource: data.source,
            aiModel: data.model ?? null,
            vertexClass: data.vertexClass ?? null,
            vertexConfidence:
              typeof data.vertexConfidence === "number"
                ? data.vertexConfidence
                : null,
            validatedAt: new Date().toISOString(),
            trustInput: {
              registered: false,
              idVerified: false,
              email: null,
              phone: mobileNumber.trim() || null,
              emailVerified: false,
              mediaSource,
              lat,
              lng,
              locationAccuracyM: fromGps
                ? (captured?.locationAccuracyM ?? null)
                : null,
            },
          });
        } catch {
          // ignore — report already queued
        }
      })();
    }

    saveGuestReportId(id);
    setSavedGuestId(id);
    setStatus(null);
    router.push(`/report-incident/received/${encodeURIComponent(id)}`);
  }

  async function submitReport() {
    if (submitting || photos.length === 0) return;
    setError(null);
    setSubmitting(true);
    setStatus(t(language, "common.saving"));

    const file = photos[0]!.file;

    try {
      if (isGuest || !author) {
        await submitGuestReport(file);
        return;
      }

      const reportId = draftId ?? crypto.randomUUID();
      const mediaType = file.type.startsWith("video/") ? "video" : "photo";
      const hazardHint = inferHazard(situation);
      const title = titleFromSituation(situation, intent, reportFor);

      let transcript = voiceTranscript?.trim() || "";
      if (voiceFile && !transcript) {
        transcript = await transcribeVoiceFile(voiceFile);
        if (transcript) setVoiceTranscript(transcript);
      }
      const notes = buildReportNotes(transcript || null);

      const captured = meta ?? (await captureReportMeta().catch(() => null));
      if (captured) setMeta(captured);

      const uploaded = await uploadReportMedia({
        citizenUid: author.uid,
        reportId,
        file,
      });

      let voicePath: string | null = null;
      let voiceUrl: string | null = null;
      let voiceMime: string | null = null;
      if (voiceFile) {
        const voiceUploaded = await uploadReportMedia({
          citizenUid: author.uid,
          reportId,
          file: voiceFile,
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

      const id = await createHazardReport({
        id: reportId,
        citizenUid: author.uid,
        citizenName: author.displayName,
        citizenPurok: authorPlace(author),
        barangay: DEFAULT_REPORT_BARANGAY,
        lgu: DEFAULT_REPORT_LGU,
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
        mediaType === "photo" && file.size <= 3.5 * 1024 * 1024;
      const mediaBase64 = canInline ? await fileToBase64(file) : undefined;
      const res = await fetch("/api/ai/validate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes,
          hazardHint,
          mediaType,
          mediaMime: uploaded.mediaMime,
          mediaBase64,
          fileName: file.name,
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
        vertexClass?: string | null;
        vertexConfidence?: number | null;
      };

      const validatedAt = new Date().toISOString();
      await updateReportValidation(id, {
        status: data.status,
        aiVerdict: data.verdict,
        aiConfidence: data.confidence,
        aiReason: data.reason,
        aiSource: data.source,
        aiModel: data.model ?? null,
        vertexClass: data.vertexClass ?? null,
        vertexConfidence:
          typeof data.vertexConfidence === "number"
            ? data.vertexConfidence
            : null,
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
        },
      });

      syncHazardReportToBigQuery({
        id,
        citizenUid: author.uid,
        citizenName: author.displayName || "Citizen",
        citizenPurok: authorPlace(author),
        barangay: DEFAULT_REPORT_BARANGAY,
        lgu: DEFAULT_REPORT_LGU,
        title,
        notes,
        hazardHint,
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
          hazardHint,
          status: "legit",
          barangay: DEFAULT_REPORT_BARANGAY,
          lgu: DEFAULT_REPORT_LGU,
          lat,
          lng,
          title,
          notes,
          citizenPurok: authorPlace(author),
          autoResponderCallAt: null,
        });
      }

      saveGuestReportId(id);
      setSavedGuestId(id);
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
      showBack
      onBack={() => {
        setError(null);
        if (recording) stopVoiceCapture(false);
        if (step === "situation") {
          if (draftId) router.push("/report-incident");
          else setStep("intent");
        } else if (step === "location") setStep("situation");
        else if (step === "review") setStep("location");
      }}
    />
  );

  if (step === "intent") {
    return (
      <Stagger className="space-y-5">
        <FadeItem>
          <CitizenHeader
            language={language}
            onLanguageChange={setLanguage}
            showHomeLink
          />
        </FadeItem>

        <FadeItem>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {citizenName}
              </p>
              <p className="text-xs text-[var(--muted)]">{citizenPurok}</p>
            </div>
            {isGuest ? (
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-[var(--foreground)]"
                onClick={() =>
                  router.push("/login/citizen?next=/report-incident")
                }
              >
                {t(language, "common.logIn")}
              </button>
            ) : (
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-[var(--danger)]"
                onClick={() => void logout()}
              >
                {t(language, "common.logOut")}
              </button>
            )}
          </div>
        </FadeItem>

        <FadeItem>
          <div className="space-y-2.5">
            <h1 className="text-[30px] leading-[1.15] font-bold tracking-tight text-[var(--foreground)]">
              {t(language, "home.tagline")}
            </h1>
            <p className="text-[15px] leading-relaxed text-[var(--muted)]">
              {t(language, "home.blurb")}
            </p>
          </div>
        </FadeItem>

        <FadeItem>
          <div className="space-y-3">
            {starting ? (
              <p className="text-center text-sm text-[var(--muted)]">
                {t(language, "common.saving")}
              </p>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {t(language, "home.reportFor")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "min-h-12 rounded-[14px] border-[1.5px] px-3 text-sm font-semibold transition",
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
                    "min-h-12 rounded-[14px] border-[1.5px] px-3 text-sm font-semibold transition",
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
            <SolidAction
              title={t(language, "home.needHelp")}
              style="danger"
              icon={
                <AlertTriangle
                  className="size-[18px] fill-white text-white"
                  aria-hidden
                />
              }
              disabled={starting}
              onClick={() => void beginReport("needHelp")}
            />
            <SolidAction
              title={t(language, "home.reportHazard")}
              style="outline"
              icon={<Activity className="size-[18px]" aria-hidden />}
              disabled={starting}
              onClick={() => void beginReport("reportHazard")}
            />
            <SolidAction
              title={t(language, "home.checkReport")}
              style="outline"
              icon={<Search className="size-[18px]" aria-hidden />}
              onClick={() => {
                if (!isGuest) {
                  router.push("/my-reports");
                  return;
                }
                router.push(
                  savedGuestId
                    ? `/report-incident/received/${encodeURIComponent(savedGuestId)}`
                    : "/reports",
                );
              }}
            />
          </div>
        </FadeItem>

        {savedGuestId ? (
          <FadeItem>
            <button
              type="button"
              className="mx-auto block max-w-full truncate text-center font-mono text-[11px] text-[var(--muted)] underline-offset-2 hover:underline"
              onClick={() =>
                router.push(
                  `/report-incident/received/${encodeURIComponent(savedGuestId)}`,
                )
              }
            >
              Last report · {savedGuestId}
            </button>
          </FadeItem>
        ) : null}

        <FadeItem>
          <StaySafeCard language={language} />
        </FadeItem>
        <FadeItem>
          <Danger911Banner language={language} />
        </FadeItem>

        {isCitizen(author) ? (
          <FadeItem>
            <div id="my-reports" className="pt-2">
              <CitizenReportsList citizenUid={author.uid} />
            </div>
          </FadeItem>
        ) : null}

        <FadeItem>
          <CitizenFooter language={language} />
        </FadeItem>
      </Stagger>
    );
  }

  return (
    <div className="space-y-[18px]">
      {wizardHeader}

      <AnimatePresence mode="wait" initial={false}>
      {step === "situation" ? (
        <motion.div
          key="situation"
          className="space-y-[18px]"
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
          />
          {draftId ? (
            <p className="font-mono text-[11px] text-[var(--muted)]">
              {draftId}
            </p>
          ) : null}

          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3.5">
            <div>
              <p className="text-xs text-[var(--muted)]">
                {t(language, "situation.type")}
              </p>
              <p className="text-base font-semibold text-[var(--foreground)]">
                {intent === "needHelp"
                  ? t(language, "intent.needHelp")
                  : t(language, "intent.reportHazard")}
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-[var(--foreground)]"
              onClick={() =>
                setIntent((v) =>
                  v === "needHelp" ? "reportHazard" : "needHelp",
                )
              }
            >
              {t(language, "common.change")}
            </button>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {t(language, "situation.whatHappening")}
            </span>
            <textarea
              rows={5}
              value={situation}
              onChange={(e) => {
                setSituation(e.target.value);
                setError(null);
              }}
              className={cn(
                "w-full resize-y rounded-xl border bg-[var(--surface)] px-3 py-2.5 text-sm outline-none",
                error
                  ? "border-[var(--danger)]"
                  : "border-[var(--border)] focus:border-[var(--foreground)]/40",
              )}
            />
            <span className="block text-xs leading-relaxed text-[var(--muted)]">
              {t(language, "situation.example")}
            </span>
          </label>

          {voiceFile && voicePreviewUrl && !recording ? (
            <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {t(language, "situation.voiceReady")}
                  </p>
                  <p className="truncate font-mono text-[10px] text-[var(--muted)]">
                    {voiceNoteLabel ?? voiceFile.name}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={voiceBusy}
                  className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                  onClick={() => void toggleVoiceRecording()}
                >
                  {t(language, "situation.voiceReRecord")}
                </button>
              </div>
              <audio
                controls
                src={voicePreviewUrl}
                className="w-full"
                preload="metadata"
              >
                {t(language, "situation.voicePlay")}
              </audio>
            </div>
          ) : (
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
                : voiceTranscribing
                  ? "Transcribing…"
                  : t(language, "situation.recordVoice")}
            </button>
          )}
          {voiceTranscript ? (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed">
              <span className="block font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Transcript
              </span>
              {voiceTranscript}
            </p>
          ) : null}

          <div className="space-y-2.5">
            <p className="text-sm font-semibold">
              {t(language, "situation.addPhoto")}
            </p>
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
                  className="flex items-center gap-2 overflow-hidden rounded-[10px] bg-[var(--surface-raised)] px-3 py-3 text-sm"
                >
                  {p.file.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.preview}
                      alt=""
                      className="size-10 rounded object-cover"
                    />
                  ) : (
                    <video
                      src={p.preview}
                      className="size-10 rounded object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{p.file.name}</span>
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
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] bg-[var(--surface)] px-3 py-3.5 text-sm font-semibold",
                    photos.length === 0 && error
                      ? "border-[var(--danger)]"
                      : "border-[var(--border)]",
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="size-4" aria-hidden />
                  {photos.length === 0
                    ? t(language, "situation.addPhotoButton")
                    : t(language, "situation.addAnotherPhoto")}
                </button>
                {photos.length === 0 ? (
                  <button
                    type="button"
                    disabled={sampleLoading}
                    onClick={() => void addSamplePhoto()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-transparent px-3 py-3 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--foreground)]/30 hover:text-[var(--foreground)] disabled:opacity-60"
                  >
                    {sampleLoading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : null}
                    {t(language, "situation.useSamplePhoto")}
                  </button>
                ) : null}
              </>
            ) : null}
            {photos.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">
                {t(language, "situation.photoHint")}
              </p>
            ) : null}
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-[#1a73d1]/[0.08] px-3 py-3">
            <Sparkles
              className="mt-0.5 size-4 shrink-0 text-[#1a73d1]"
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-[#1a73d1]">
              {t(language, "situation.aiNote")}
            </p>
          </div>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <SolidAction
            title={t(language, "situation.nextLocation")}
            style="dark"
            onClick={() => {
              if (validateSituation()) setStep("location");
            }}
          />
          <Danger911Banner language={language} />
          <CitizenFooter language={language} />
        </motion.div>
      ) : null}

      {step === "location" ? (
        <motion.div
          key="location"
          className="space-y-[18px]"
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
          />
          <h2 className="text-2xl font-bold tracking-tight">
            {t(language, "location.title")}
          </h2>

          <button
            type="button"
            disabled={gpsLoading}
            onClick={() => void captureGps()}
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

          <div className="space-y-2">
            <label className="block space-y-2">
              <span className="text-xs text-[var(--muted)]">
                {t(language, "location.searchLabel")}
              </span>
              <input
                value={placeQuery}
                onChange={(e) => {
                  const next = e.target.value;
                  setPlaceQuery(next);
                  setFromGps(false);
                  setError(null);
                  const hit = filterPlaces(next).find(
                    (p) =>
                      placeLabel(p).toLowerCase() === next.trim().toLowerCase(),
                  );
                  if (hit) {
                    setLat(hit.lat);
                    setLng(hit.lng);
                    setMapZoom(15);
                  }
                }}
                placeholder={t(language, "location.searchPlaceholder")}
                className={cn(
                  "w-full rounded-xl border bg-[var(--surface)] px-3 py-3 text-sm outline-none",
                  error
                    ? "border-[var(--danger)]"
                    : "border-[var(--border)] focus:border-[var(--foreground)]/40",
                )}
              />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {placeHits.map((p) => {
                const label = placeLabel(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPlace(p)}
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap",
                      placeQuery === label
                        ? "border-[var(--foreground)] bg-[var(--surface)]"
                        : "border-[var(--border)] bg-[var(--surface)]",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

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
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {t(language, "location.mapHint")}
          </p>
          <p className="font-mono text-xs text-[var(--muted)]">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">
              {t(language, "location.landmark")}
            </span>
            <input
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder={t(language, "location.landmarkPlaceholder")}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm outline-none focus:border-[var(--foreground)]/40"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>{t(language, "location.approximate")}</span>
            <input
              type="checkbox"
              checked={approximate}
              onChange={(e) => setApproximate(e.target.checked)}
              className="size-4 accent-[#1a73d1]"
            />
          </label>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <SolidAction
            title={t(language, "location.nextReview")}
            style="dark"
            onClick={() => {
              if (validateLocation()) setStep("review");
            }}
          />
          <Danger911Banner language={language} />
          <CitizenFooter language={language} />
        </motion.div>
      ) : null}

      {step === "review" ? (
        <motion.div
          key="review"
          className="space-y-[18px]"
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
          />
          <h2 className="text-2xl font-bold tracking-tight">
            {t(language, "review.title")}
          </h2>

          <div className="min-w-0 space-y-3">
            <div className="min-w-0 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  {t(language, "review.situation")}
                </p>
                <button
                  type="button"
                  className="text-sm font-semibold"
                  onClick={() => setStep("situation")}
                >
                  {t(language, "common.edit")}
                </button>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                {intent === "needHelp"
                  ? t(language, "intent.needHelp")
                  : t(language, "intent.reportHazard")}
                {" · "}
                {reportFor === "someoneElse"
                  ? t(language, "home.forSomeoneElse")
                  : t(language, "home.forMyself")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{situation}</p>
              <div className="mt-2.5 space-y-1 rounded-[10px] bg-[#1a73d1]/[0.08] p-2.5 text-xs text-[#1a73d1]">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="size-3.5" aria-hidden />
                  {t(language, "review.aiCheck")}
                </p>
                <p className="font-semibold">
                  {t(language, "review.verdict", {
                    value: t(language, "common.pending"),
                  })}
                </p>
                <p>
                  {t(language, "review.category", {
                    value: inferHazard(situation),
                  })}
                </p>
                <p>{t(language, "review.pendingHuman")}</p>
              </div>
            </div>

            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  {t(language, "review.location")}
                </p>
                <button
                  type="button"
                  className="text-sm font-semibold"
                  onClick={() => setStep("location")}
                >
                  {t(language, "common.edit")}
                </button>
              </div>
              <p className="mt-1 text-sm font-semibold">{placeQuery}</p>
              <p className="font-mono text-xs text-[var(--muted)]">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
              {fromGps ? (
                <p className="text-xs text-[var(--success)]">
                  {t(language, "location.fromGps")}
                </p>
              ) : null}
              {landmark ? (
                <p className="text-sm text-[var(--muted)]">{landmark}</p>
              ) : null}
              {approximate ? (
                <p className="text-xs text-[var(--warn)]">
                  {t(language, "review.approxLocation")}
                </p>
              ) : null}
            </div>

            <div className="min-w-0 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">
                  {t(language, "review.attachments")}
                </p>
                <button
                  type="button"
                  className="shrink-0 text-sm font-semibold"
                  onClick={() => setStep("situation")}
                >
                  {t(language, "common.edit")}
                </button>
              </div>
              {photos.map((p) => (
                <p
                  key={p.id}
                  className="mt-1 truncate text-sm"
                  title={p.file.name}
                >
                  {p.file.name}
                </p>
              ))}
              {voiceNoteLabel ? (
                <p className="mt-1 truncate text-sm">{voiceNoteLabel}</p>
              ) : null}
              {voiceTranscribing ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Transcribing voice…
                </p>
              ) : null}
              {voiceTranscript ? (
                <p className="mt-1.5 text-sm leading-relaxed">
                  <span className="text-[var(--muted)]">Transcript: </span>
                  {voiceTranscript}
                </p>
              ) : null}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">
              {t(language, "review.mobileOptional")}
            </span>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => {
                setMobileNumber(e.target.value);
                setError(null);
              }}
              placeholder="09XX XXX XXXX"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm outline-none focus:border-[var(--foreground)]/40"
            />
            <span className="block text-xs text-[var(--muted)]">
              {t(language, "review.mobileHint")}
            </span>
          </label>

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

          <SolidAction
            title={
              submitting
                ? t(language, "common.saving")
                : t(language, "review.submit")
            }
            style="danger"
            disabled={submitting}
            icon={
              submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )
            }
            onClick={() => void submitReport()}
          />
          <p className="text-xs text-[var(--muted)]">
            {t(language, "review.disclaimer")}
          </p>
          <CitizenFooter language={language} />
        </motion.div>
      ) : null}
      </AnimatePresence>
    </div>
  );
}
