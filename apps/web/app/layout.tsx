import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tune-In",
  description: "Trajectory-based social growth platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
