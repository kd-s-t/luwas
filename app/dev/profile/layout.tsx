import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dev profile · UGNAI",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
