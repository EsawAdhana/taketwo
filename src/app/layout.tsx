import '@/app/globals.css';
import { Inter } from 'next/font/google';
import { getServerSession } from 'next-auth';
import SessionProvider from '@/components/SessionProvider';
import Navigation from '@/components/Navigation';

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
          <div className="relative min-h-screen">
            {session && <Navigation />}
            {children}
          </div>
        </SessionProvider>
      </body>
    </html>
  );
} 