import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dev incident · UGNAI",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
