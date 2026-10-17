import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evac centers · UGNAI",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
