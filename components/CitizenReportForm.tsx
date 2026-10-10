"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LocateFixed,
  Mic,
  Plus,
  Search,
  Sparkles,
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
  createHazardReport,
  markReportValidating,
  updateReportValidation,
} from "@/lib/reports/api";
import {
  DEFAULT_REPORT_BARANGAY,
  DEFAULT_REPORT_LGU,
} from "@/lib/reports/barangayScope";
import type { ReportHazardHint } from "@/lib/reports/types";
import {
  latestGuestReportId,
  saveGuestReportId,
} from "@/lib/reports/guestReportStore";
import { takePendingReportMedia } from "@/lib/reports/pendingMedia";
import { fileToBase64, uploadReportMedia } from "@/lib/reports/upload";
import {
  filterPlaces,
  NANGKA_HALL,
  placeLabel,
  type ServiceAreaPlace,
} from "@/lib/reports/serviceAreaPlaces";
import { cn } from "@/lib/utils";

type Step = "intent" | "situation" | "location" | "review" | "confirm";
type Intent = "needHelp" | "reportHazard";

type CitizenReportFormProps = {
  /** Null/undefined = guest (no login), same as iOS. */
  author?: UserProfile | null;
};

type PhotoItem = { id: string; file: File; preview: string };

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
  if (/typhoon|bagyo|hangin|wind|storm/.test(t)) return "typhoon";
  if (/fire|sunog|usok|smoke/.test(t)) return "fire";
  if (/evac|shelter|evacuation/.test(t)) return "evac";
  return "other";
}

function titleFromSituation(situation: string, intent: Intent): string {
  const line = situation.trim().split(/\n/)[0]?.trim() ?? "";
  if (line.length >= 8) return line.slice(0, 80);
  return intent === "needHelp" ? "I need help" : "Hazard report";
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
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-[16px] text-[17px] font-semibold transition active:scale-[0.98] disabled:opacity-60",
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
    </button>
  );
}

export function CitizenReportForm({ author = null }: CitizenReportFormProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const isGuest = !author;
  const [language, setLanguage] = useState<CitizenLang>("en");
  const [step, setStep] = useState<Step>("intent");
  const [intent, setIntent] = useState<Intent>("needHelp");
  const [situation, setSituation] = useState("");
  const [voiceNoteLabel, setVoiceNoteLabel] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [placeQuery, setPlaceQuery] = useState("Brgy. Nangka, Consolacion");
  const [lat, setLat] = useState<number>(NANGKA_HALL.lat);
  const [lng, setLng] = useState<number>(NANGKA_HALL.lng);
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
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [confirmVerdict, setConfirmVerdict] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReportCaptureMeta | null>(null);
  const [mobileCapture, setMobileCapture] = useState(false);
  const [copied, setCopied] = useState(false);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, []);

  function resetDraft() {
    setSituation("");
    setVoiceNoteLabel(null);
    setPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.preview);
      return [];
    });
    setPlaceQuery("Brgy. Nangka, Consolacion");
    setLat(NANGKA_HALL.lat);
    setLng(NANGKA_HALL.lng);
    setLandmark("");
    setApproximate(true);
    setFromGps(false);
    setError(null);
    setStatus(null);
    setCopied(false);
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setPhotos((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          continue;
        }
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
    setFromGps(false);
    setError(null);
  }

  async function useGps() {
    setGpsLoading(true);
    setError(null);
    try {
      const captured = await captureReportMeta();
      setMeta(captured);
      if (captured.lat != null && captured.lng != null) {
        setLat(captured.lat);
        setLng(captured.lng);
        setFromGps(true);
        if (captured.locationLabel) setPlaceQuery(captured.locationLabel);
      } else {
        setError("Could not get GPS. Pick a place below.");
      }
    } catch {
      setError("Location permission denied or unavailable.");
    } finally {
      setGpsLoading(false);
    }
  }

  function validateSituation(): boolean {
    const text = situation.trim();
    if (text.length < 20) {
      setError("Describe what’s happening (at least 20 characters).");
      return false;
    }
    if (photos.length < 1) {
      setError("Add at least one photo.");
      return false;
    }
    setError(null);
    return true;
  }

  function validateLocation(): boolean {
    if (!placeQuery.trim()) {
      setError("Choose or search a place.");
      return false;
    }
    setError(null);
    return true;
  }

  async function submitGuestReport(file: File) {
    setStatus("Saving to LUWAS…");
    const hazardHint = inferHazard(situation);
    const title = titleFromSituation(situation, intent);
    const notes = [
      situation.trim(),
      landmark.trim() ? `Landmark: ${landmark.trim()}` : "",
      voiceNoteLabel ? `Voice: ${voiceNoteLabel}` : "",
      approximate ? "Approximate location" : "",
      intent === "needHelp" ? "Intent: I need help" : "Intent: Report a hazard",
    ]
      .filter(Boolean)
      .join("\n");

    const canInline =
      !file.type.startsWith("video/") && file.size <= 3.5 * 1024 * 1024;
    const mediaBase64 = canInline ? await fileToBase64(file) : undefined;

    let aiVerdict: "legit" | "rejected" | "needs_review" | undefined;
    let aiConfidence: number | undefined;
    let aiReason: string | undefined;
    if (mediaBase64) {
      const res = await fetch("/api/ai/validate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes,
          hazardHint,
          mediaType: "photo",
          mediaMime: file.type || "image/jpeg",
          mediaBase64,
          fileName: file.name,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          verdict: "legit" | "rejected" | "needs_review";
          confidence: number;
          reason: string;
        };
        aiVerdict = data.verdict;
        aiConfidence = data.confidence;
        aiReason = data.reason;
      }
    }

    const ingest = await fetch("/api/reports/ios-ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "web",
        situation: situation.trim(),
        placeLabel: placeQuery.trim(),
        landmark: landmark.trim(),
        latitude: lat,
        longitude: lng,
        approximateLocation: approximate,
        mobileNumber: mobileNumber.trim(),
        photoNames: photos.map((p) => p.file.name),
        intent,
        citizenName: "Guest",
        citizenPurok: "Demo · no login",
        mediaBase64,
        mediaMime: file.type || "image/jpeg",
        aiVerdict,
        aiConfidence,
        aiReason,
      }),
    });
    if (!ingest.ok) {
      const text = await ingest.text();
      throw new Error(
        text.slice(0, 180) ||
          `Could not submit guest report (${ingest.status})`,
      );
    }
    const data = (await ingest.json()) as {
      id: string;
      aiVerdict?: string;
    };
    saveGuestReportId(data.id);
    setReferenceId(data.id);
    setConfirmVerdict(data.aiVerdict ?? aiVerdict ?? null);
    setStep("confirm");
    setStatus(null);
  }

  async function submitReport() {
    if (submitting || photos.length === 0) return;
    setError(null);
    setSubmitting(true);
    setStatus("Saving to LUWAS…");

    const file = photos[0]!.file;

    try {
      if (isGuest || !author) {
        await submitGuestReport(file);
        return;
      }

      const reportId = crypto.randomUUID();
      const mediaType = file.type.startsWith("video/") ? "video" : "photo";
      const hazardHint = inferHazard(situation);
      const title = titleFromSituation(situation, intent);
      const notes = [
        situation.trim(),
        landmark.trim() ? `Landmark: ${landmark.trim()}` : "",
        voiceNoteLabel ? `Voice: ${voiceNoteLabel}` : "",
        approximate ? "Approximate location" : "",
        intent === "needHelp" ? "Intent: I need help" : "Intent: Report a hazard",
      ]
        .filter(Boolean)
        .join("\n");

      const captured = meta ?? (await captureReportMeta().catch(() => null));
      if (captured) setMeta(captured);

      const uploaded = await uploadReportMedia({
        citizenUid: author.uid,
        reportId,
        file,
      });

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
      };

      await updateReportValidation(id, {
        status: data.status,
        aiVerdict: data.verdict,
        aiConfidence: data.confidence,
        aiReason: data.reason,
        aiSource: data.source,
        aiModel: data.model ?? null,
        validatedAt: new Date().toISOString(),
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

      setReferenceId(id);
      setConfirmVerdict(data.verdict);
      setStep("confirm");
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit report");
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  const osmEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.008}%2C${lng + 0.01}%2C${lat + 0.008}&layer=mapnik&marker=${lat}%2C${lng}`;

  const wizardHeader = (
    <CitizenHeader
      language={language}
      onLanguageChange={setLanguage}
      showHomeLink
      showBack
      onBack={() => {
        setError(null);
        if (step === "situation") setStep("intent");
        else if (step === "location") setStep("situation");
        else if (step === "review") setStep("location");
        else if (step === "confirm") setStep("intent");
      }}
    />
  );

  if (step === "confirm" && referenceId) {
    return (
      <div className="space-y-[18px]">
        <CitizenHeader
          language={language}
          onLanguageChange={setLanguage}
          showHomeLink
        />
        <div className="space-y-2">
          <CheckCircle2
            className="size-11 text-[var(--success)]"
            aria-hidden
          />
          <h2 className="text-2xl font-bold text-[var(--foreground)]">
            {t(language, "confirm.title")}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {t(language, "confirm.body")}
          </p>
          {confirmVerdict ? (
            <p className="text-xs text-[var(--muted)]">
              AI · {confirmVerdict.replace("_", " ")}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
            {t(language, "confirm.reference")}
          </p>
          <p className="mt-2 font-mono text-[28px] font-bold tracking-tight text-[var(--foreground)]">
            {referenceId}
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-[10px] bg-[var(--surface-raised)] py-3 text-sm font-semibold"
            onClick={() => {
              void navigator.clipboard?.writeText(referenceId);
              setCopied(true);
            }}
          >
            {copied
              ? t(language, "common.copied")
              : t(language, "confirm.copy")}
          </button>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/15 p-3.5">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-[var(--warn)]"
            aria-hidden
          />
          <p className="text-sm text-[var(--foreground)]">
            {t(language, "confirm.noResponder")}
          </p>
        </div>

        <SolidAction
          title={t(language, "confirm.track")}
          style="dark"
          onClick={() => {
            const id = referenceId;
            resetDraft();
            setReferenceId(null);
            setConfirmVerdict(null);
            setStep("intent");
            if (isGuest && id) {
              router.push(`/reports/${id}`);
              return;
            }
            router.push(isGuest ? "/reports" : "/my-reports");
          }}
        />
        <SolidAction
          title={t(language, "confirm.home")}
          style="outline"
          onClick={() => {
            resetDraft();
            setReferenceId(null);
            setConfirmVerdict(null);
            setStep("intent");
          }}
        />
        <CitizenFooter language={language} />
      </div>
    );
  }

  if (step === "intent") {
    const savedGuestId = isGuest ? latestGuestReportId() : null;
    return (
      <div className="space-y-5">
        <CitizenHeader
          language={language}
          onLanguageChange={setLanguage}
          showHomeLink
        />

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

        <div className="space-y-2.5">
          <h1 className="text-[30px] leading-[1.15] font-bold tracking-tight text-[var(--foreground)]">
            {t(language, "home.tagline")}
          </h1>
          <p className="text-[15px] leading-relaxed text-[var(--muted)]">
            {t(language, "home.blurb")}
          </p>
        </div>

        <div className="space-y-3">
          <SolidAction
            title={t(language, "home.needHelp")}
            style="danger"
            icon={
              <AlertTriangle
                className="size-[18px] fill-white text-white"
                aria-hidden
              />
            }
            onClick={() => {
              setIntent("needHelp");
              setStep("situation");
              setError(null);
            }}
          />
          <SolidAction
            title={t(language, "home.reportHazard")}
            style="outline"
            icon={<Activity className="size-[18px]" aria-hidden />}
            onClick={() => {
              setIntent("reportHazard");
              setStep("situation");
              setError(null);
            }}
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
              router.push(savedGuestId ? `/reports/${savedGuestId}` : "/reports");
            }}
          />
        </div>

        {savedGuestId ? (
          <p className="text-center font-mono text-[11px] text-[var(--muted)]">
            Last report · {savedGuestId}
          </p>
        ) : null}

        <StaySafeCard language={language} />
        <Danger911Banner language={language} />

        {isCitizen(author) ? (
          <div id="my-reports" className="pt-2">
            <CitizenReportsList citizenUid={author.uid} />
          </div>
        ) : null}

        <CitizenFooter language={language} />
      </div>
    );
  }

  return (
    <div className="space-y-[18px]">
      {wizardHeader}

      {step === "situation" ? (
        <>
          <StepProgress
            step={1}
            title={t(language, "step.situation")}
            language={language}
          />

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

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-3 py-3.5 text-sm font-semibold"
            onClick={() =>
              setVoiceNoteLabel(
                `Voice note · ${new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`,
              )
            }
          >
            <Mic className="size-4" aria-hidden />
            {voiceNoteLabel ?? t(language, "situation.recordVoice")}
          </button>

          <div className="space-y-2.5">
            <p className="text-sm font-semibold">
              {t(language, "situation.addPhoto")}
            </p>
            {photos.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-[10px] bg-[var(--surface-raised)] px-3 py-3 text-sm"
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
                  aria-label="Remove photo"
                  onClick={() => removePhoto(p.id)}
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < 3 ? (
              <label
                className={cn(
                  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] bg-[var(--surface)] px-3 py-3.5 text-sm font-semibold",
                  photos.length === 0 && error
                    ? "border-[var(--danger)]"
                    : "border-[var(--border)]",
                )}
              >
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  {...(mobileCapture
                    ? { capture: "environment" as const }
                    : {})}
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Plus className="size-4" aria-hidden />
                {photos.length === 0
                  ? t(language, "situation.addPhotoButton")
                  : t(language, "situation.addAnotherPhoto")}
              </label>
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
        </>
      ) : null}

      {step === "location" ? (
        <>
          <StepProgress
            step={2}
            title={t(language, "step.location")}
            language={language}
          />
          <h2 className="text-2xl font-bold tracking-tight">
            Where is help needed?
          </h2>

          <button
            type="button"
            disabled={gpsLoading}
            onClick={() => void useGps()}
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
            {gpsLoading ? "Getting GPS…" : "Use my current location"}
          </button>

          <div className="space-y-2">
            <label className="block space-y-2">
              <span className="text-xs text-[var(--muted)]">
                Search barangay or city
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
                  }
                }}
                placeholder="Brgy. Nangka, Consolacion"
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

          <div className="relative overflow-hidden rounded-[14px] border border-[var(--border)]">
            <iframe
              title="Report location map"
              src={osmEmbed}
              className="h-[260px] w-full border-0"
              loading="lazy"
            />
            {fromGps ? (
              <span className="absolute top-2.5 right-2.5 rounded-full bg-[var(--success)] px-2 py-1 text-[10px] font-bold text-white uppercase">
                GPS
              </span>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Map — pan to move the pin, or pick a hall chip. Hall chips use real
            Consolacion coordinates.
          </p>
          <p className="font-mono text-xs text-[var(--muted)]">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">
              Nearby landmark (optional)
            </span>
            <input
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="Near barangay hall"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm outline-none focus:border-[var(--foreground)]/40"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>This is an approximate location</span>
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
            title="Next: Review report"
            style="dark"
            onClick={() => {
              if (validateLocation()) setStep("review");
            }}
          />
          <Danger911Banner language={language} />
          <CitizenFooter language={language} />
        </>
      ) : null}

      {step === "review" ? (
        <>
          <StepProgress
            step={3}
            title={t(language, "step.review")}
            language={language}
          />
          <h2 className="text-2xl font-bold tracking-tight">Review & submit</h2>

          <div className="space-y-3">
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Situation</p>
                <button
                  type="button"
                  className="text-sm font-semibold"
                  onClick={() => setStep("situation")}
                >
                  Edit
                </button>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                {intent === "needHelp" ? "I Need Help" : "Report a Hazard"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{situation}</p>
              <div className="mt-2.5 space-y-1 rounded-[10px] bg-[#1a73d1]/[0.08] p-2.5 text-xs text-[#1a73d1]">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="size-3.5" aria-hidden />
                  AI check (local rules)
                </p>
                <p className="font-semibold">
                  Verdict: {confirmVerdict?.replace("_", " ") ?? "Pending"}
                </p>
                <p>Category: {inferHazard(situation)}</p>
                <p>Verification: Pending human review</p>
              </div>
            </div>

            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Location</p>
                <button
                  type="button"
                  className="text-sm font-semibold"
                  onClick={() => setStep("location")}
                >
                  Edit
                </button>
              </div>
              <p className="mt-1 text-sm font-semibold">{placeQuery}</p>
              <p className="font-mono text-xs text-[var(--muted)]">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
              {fromGps ? (
                <p className="text-xs text-[var(--success)]">From device GPS</p>
              ) : null}
              {landmark ? (
                <p className="text-sm text-[var(--muted)]">{landmark}</p>
              ) : null}
              {approximate ? (
                <p className="text-xs text-[var(--warn)]">Approximate location</p>
              ) : null}
            </div>

            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Attachments</p>
                <button
                  type="button"
                  className="text-sm font-semibold"
                  onClick={() => setStep("situation")}
                >
                  Edit
                </button>
              </div>
              {photos.map((p) => (
                <p key={p.id} className="mt-1 text-sm">
                  {p.file.name}
                </p>
              ))}
              {voiceNoteLabel ? (
                <p className="mt-1 text-sm">{voiceNoteLabel}</p>
              ) : null}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">
              Mobile number (optional)
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
              PH mobile preferred (09XXXXXXXXX). Used only if a responder needs
              to reach you.
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
            title={submitting ? "Saving to LUWAS…" : "Submit report"}
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
            LUWAS will not present unverified rescue or aid as confirmed.
          </p>
          <CitizenFooter language={language} />
        </>
      ) : null}
    </div>
  );
}
