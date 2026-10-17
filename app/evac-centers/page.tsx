import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { PublicEvacCentersList } from "@/components/PublicEvacCentersList";

export const metadata = {
  title: "Evac centers · UGNAI",
};

export default function PublicEvacCentersPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Shelter"
        title="Evac centers"
        description="Open shelters for your barangay: how full they are, what is stored on site, and whether they are usable."
      />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PublicEvacCentersList />
      </main>
    </PublicShell>
  );
}
