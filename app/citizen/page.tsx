import { redirect } from "next/navigation";

/** Legacy path — My reports lives at /my-reports. */
export default function CitizenRedirectPage() {
  redirect("/my-reports");
}
