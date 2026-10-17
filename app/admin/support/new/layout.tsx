import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New support ticket · UGNAI",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
