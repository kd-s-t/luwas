import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer hub · UGNAI",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
