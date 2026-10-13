/** Mirror chapter-studio `src/integrations/elevenlabs/constants.ts` (TTS subset). */

export const ELEVENLABS_ENV_KEY = "ELEVENLABS_API_KEY";

/** George — warm captivating storyteller (chapter-studio narration). */
export const ELEVENLABS_VOICE_GEORGE = "JBFqnCBsd6RMkjVDRZzb";

/** Bertch - Travel Buddy — Filipino / Cebuano library voice (needs paid API plan). */
export const ELEVENLABS_VOICE_BERTCH = "2YPDVPh2YeXiRMgJXtvc";

/** Default Mangluluwas voice (George — free premade, works on free API). */
export const ELEVENLABS_NARRATION_VOICE = ELEVENLABS_VOICE_GEORGE;

/** Free-tier safe premade voice when library voices return paid_plan_required. */
export const ELEVENLABS_FREE_FALLBACK_VOICE = ELEVENLABS_VOICE_GEORGE;

export const ELEVENLABS_DEFAULT_TTS_MODEL = "eleven_multilingual_v2";
