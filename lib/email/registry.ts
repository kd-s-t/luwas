/** Transactional email catalog for command preview. */

export type EmailTemplateCategory = "auth" | "alerts" | "reports" | "staff";

export type EmailTemplateId =
  | "register"
  | "verified"
  | "account_approved"
  | "account_rejected"
  | "welcome"
  | "officer_add_existing"
  | "officer_add_new"
  | "eq_alert"
  | "fire_alert"
  | "typhoon_alert"
  | "evacuate_alert"
  | "prepare_alert"
  | "report_verified"
  | "report_done";

export type EmailTemplateMeta = {
  id: EmailTemplateId;
  category: EmailTemplateCategory;
  name: string;
  description: string;
  event: string;
};

export const EMAIL_TEMPLATE_CATEGORIES: {
  id: EmailTemplateCategory;
  label: string;
}[] = [
  { id: "auth", label: "Account" },
  { id: "staff", label: "Staff" },
  { id: "alerts", label: "Alerts" },
  { id: "reports", label: "Reports" },
];

export const EMAIL_TEMPLATES: EmailTemplateMeta[] = [
  {
    id: "register",
    category: "auth",
    name: "Register",
    description: "Sent when a citizen creates an account — verify email link.",
    event: "register",
  },
  {
    id: "verified",
    category: "auth",
    name: "Verified",
    description: "Sent after the citizen confirms their email address.",
    event: "verified",
  },
  {
    id: "account_approved",
    category: "auth",
    name: "Account approved",
    description:
      "Sent when a registration is approved (homeowner match or officer).",
    event: "account_approved",
  },
  {
    id: "account_rejected",
    category: "auth",
    name: "Account rejected",
    description: "Sent when barangay staff rejects a registration.",
    event: "account_rejected",
  },
  {
    id: "welcome",
    category: "auth",
    name: "Welcome",
    description: "Welcome mail once the citizen account is ready for alerts.",
    event: "welcome",
  },
  {
    id: "officer_add_existing",
    category: "staff",
    name: "Add existing officer",
    description:
      "Sent when the captain promotes a house owner to an officer login.",
    event: "officer_add_existing",
  },
  {
    id: "officer_add_new",
    category: "staff",
    name: "Add new officer",
    description:
      "Sent when the captain creates a brand-new officer account.",
    event: "officer_add_new",
  },
  {
    id: "eq_alert",
    category: "alerts",
    name: "Earthquake alert",
    description: "Immediate alert when an earthquake is detected near the barangay.",
    event: "eq_alert",
  },
  {
    id: "fire_alert",
    category: "alerts",
    name: "Fire alert",
    description: "Immediate alert when a fire is reported in or near the barangay.",
    event: "fire_alert",
  },
  {
    id: "typhoon_alert",
    category: "alerts",
    name: "Typhoon alert (3 days)",
    description:
      "Advance warning ~3 days before an incoming typhoon / landfall window.",
    event: "typhoon_alert",
  },
  {
    id: "evacuate_alert",
    category: "alerts",
    name: "Evacuate alert",
    description:
      "Branded email blast when officers alert households to evacuate (not SMS text).",
    event: "evacuate_alert",
  },
  {
    id: "prepare_alert",
    category: "alerts",
    name: "Prepare alert",
    description:
      "Branded email blast for shelter-in-place / stock-up guidance.",
    event: "prepare_alert",
  },
  {
    id: "report_verified",
    category: "reports",
    name: "Report verified",
    description:
      "Sent to the citizen when their field report is accepted as verified / legit.",
    event: "report_verified",
  },
  {
    id: "report_done",
    category: "reports",
    name: "Report done",
    description:
      "Sent when an officer marks the incident done — reporter, assigned officers, and captain.",
    event: "report_done",
  },
];

export function isEmailTemplateId(value: string): value is EmailTemplateId {
  return EMAIL_TEMPLATES.some((t) => t.id === value);
}

export function getEmailTemplate(
  id: EmailTemplateId,
): EmailTemplateMeta | undefined {
  return EMAIL_TEMPLATES.find((t) => t.id === id);
}
