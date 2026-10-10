import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LUWAS UI Bootstrap (Dev)",
  description:
    "LUWAS design-system gallery — Tailwind, shadcn/ui, Lucide, and Framer Motion.",
};

export default function BootstrapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
