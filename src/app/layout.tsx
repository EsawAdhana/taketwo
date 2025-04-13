import '@/app/globals.css';
import { Inter } from 'next/font/google';
import { getServerSession } from 'next-auth';
import SessionProvider from '@/components/SessionProvider';
import Navigation from '@/components/Navigation';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SurveyNavigationProvider } from '@/contexts/SurveyNavigationContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'MonkeyHouse',
  description: 'Find your perfect roommate match for your internship',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider session={session}>
          <ThemeProvider>
            <SurveyNavigationProvider>
              <div className="relative min-h-screen dark:bg-gray-900 dark:text-white">
                {session && <Navigation />}
                {children}
              </div>
            </SurveyNavigationProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
} 