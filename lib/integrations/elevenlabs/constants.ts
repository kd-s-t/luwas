/** Mirror chapter-studio `src/integrations/elevenlabs/constants.ts` (TTS subset). */

export const ELEVENLABS_ENV_KEY = "ELEVENLABS_API_KEY";

/** George — warm captivating storyteller (chapter-studio narration). */
export const ELEVENLABS_VOICE_GEORGE = "JBFqnCBsd6RMkjVDRZzb";

/** Grandpa Spuds Oxley — Voice Library (needs paid API plan, e.g. Starter). */
export const ELEVENLABS_VOICE_SPUDS_OXLEY = "NOpBlnGInO9m6vDvFkFC";

/** Si Airmac — Voice Library (needs paid API plan). */
export const ELEVENLABS_VOICE_SI_AIRMAC = "V9wXgxyhEFNo2WPR5uBy";

/** Bertch - Travel Buddy — Filipino / Cebuano library voice (needs paid API plan). */
export const ELEVENLABS_VOICE_BERTCH = "2YPDVPh2YeXiRMgJXtvc";

/** Default Mangugnai voice (Si Airmac — paid Starter+ library voice). */
export const ELEVENLABS_NARRATION_VOICE = ELEVENLABS_VOICE_SI_AIRMAC;

/** Free-tier safe premade voice when library voices return paid_plan_required. */
export const ELEVENLABS_FREE_FALLBACK_VOICE = ELEVENLABS_VOICE_GEORGE;

export const ELEVENLABS_DEFAULT_TTS_MODEL = "eleven_multilingual_v2";
