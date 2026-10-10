/** SMS / text catalog for command preview. */

export type TextTemplateCategory = "auth" | "alerts" | "reports";

export type TextTemplateId =
  | "register"
  | "verified"
  | "welcome"
  | "eq_alert"
  | "fire_alert"
  | "typhoon_alert"
  | "evacuate_alert"
  | "prepare_alert"
  | "report_verified";

export type TextTemplateMeta = {
  id: TextTemplateId;
  category: TextTemplateCategory;
  name: string;
  description: string;
  event: string;
};

export const TEXT_TEMPLATE_CATEGORIES: {
  id: TextTemplateCategory;
  label: string;
}[] = [
  { id: "auth", label: "Account" },
  { id: "alerts", label: "Alerts" },
  { id: "reports", label: "Reports" },
];

export const TEXT_TEMPLATES: TextTemplateMeta[] = [
  {
    id: "register",
    category: "auth",
    name: "Register",
    description: "SMS when a citizen creates an account — verify code / link hint.",
    event: "register",
  },
  {
    id: "verified",
    category: "auth",
    name: "Verified",
    description: "SMS after the citizen confirms their mobile / email.",
    event: "verified",
  },
  {
    id: "welcome",
    category: "auth",
    name: "Welcome",
    description: "Welcome SMS once the citizen is on the alert roster.",
    event: "welcome",
  },
  {
    id: "eq_alert",
    category: "alerts",
    name: "Earthquake alert",
    description: "Immediate SMS when an earthquake is detected near the barangay.",
    event: "eq_alert",
  },
  {
    id: "fire_alert",
    category: "alerts",
    name: "Fire alert",
    description: "Immediate SMS when a fire is reported near the household.",
    event: "fire_alert",
  },
  {
    id: "typhoon_alert",
    category: "alerts",
    name: "Typhoon alert (3 days)",
    description:
      "Advance SMS ~3 days before an incoming typhoon / landfall window.",
    event: "typhoon_alert",
  },
  {
    id: "evacuate_alert",
    category: "alerts",
    name: "Evacuate alert",
    description: "SMS blast telling households to evacuate now.",
    event: "evacuate_alert",
  },
  {
    id: "prepare_alert",
    category: "alerts",
    name: "Prepare alert",
    description: "SMS blast for shelter-in-place / stock-up guidance.",
    event: "prepare_alert",
  },
  {
    id: "report_verified",
    category: "reports",
    name: "Report verified",
    description:
      "SMS when a citizen’s field report is accepted as verified / legit.",
    event: "report_verified",
  },
];

export function isTextTemplateId(value: string): value is TextTemplateId {
  return TEXT_TEMPLATES.some((t) => t.id === value);
}

export function getTextTemplate(
  id: TextTemplateId,
): TextTemplateMeta | undefined {
  return TEXT_TEMPLATES.find((t) => t.id === id);
}
