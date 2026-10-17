import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My reports · UGNAI",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
