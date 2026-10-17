import { redirect } from "next/navigation";

export const metadata = {
  title: "Citizen home · UGNAI",
};

/** Legacy path — My reports lives at /my-reports. */
export default function CitizenRedirectPage() {
  redirect("/my-reports");
}
