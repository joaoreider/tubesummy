import "./globals.css";
import { FlashcardProvider } from "../lib/contexts/flashcard-context";

export const metadata = {
  title: "TubeStudy - Learn from YouTube Videos",
  description: "Generate flashcards from YouTube videos for effective studying",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <FlashcardProvider>{children}</FlashcardProvider>
      </body>
    </html>
  );
}
