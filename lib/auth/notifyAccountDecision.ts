/** Fire-and-forget email when a registration is approved or rejected. */
export async function notifyAccountDecision(input: {
  decision: "approved" | "rejected";
  email: string;
  name: string;
  barangay?: string | null;
  lgu?: string | null;
  purok?: string | null;
  phone?: string | null;
}): Promise<void> {
  const email = input.email.trim();
  if (!email) return;
  try {
    await fetch("/api/auth/account-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: input.decision,
        email,
        name: input.name,
        barangay: input.barangay ?? undefined,
        lgu: input.lgu ?? undefined,
        purok: input.purok ?? undefined,
        phone: input.phone ?? undefined,
      }),
    });
  } catch (err) {
    console.warn("[account-decision email]", err);
  }
}
