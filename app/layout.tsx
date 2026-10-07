import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calendário Acadêmico 2027 | Graduação",
  description: "Calendário anual da graduação EAD e semipresencial, com atividades, provas e prazos acadêmicos.",
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg`,
    shortcut: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
