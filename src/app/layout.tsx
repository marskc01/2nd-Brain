import "./styles.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "KDN Brain",
  description: "Turn useful captures into work you can use.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
