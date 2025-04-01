'use client';

import { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    const checkSurvey = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/survey');
          const result = await response.json();
          
          if (!result.data?.isSubmitted) {
            router.push('/survey');
          } else {
            router.push('/dashboard');
          }
        } catch (error) {
          console.error('Error checking survey:', error);
        }
      }
    };
    
    if (status === 'authenticated') {
      checkSurvey();
    }
  }, [session, status, router]);
  
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">
          Welcome to TakeTwo
        </h1>
        
        <div className="text-center">
          {status === 'loading' ? (
            <div className="animate-pulse">Loading...</div>
          ) : session ? (
            <div className="animate-pulse text-gray-600">
              Checking your profile...
            </div>
          ) : (
            <>
              <p className="mb-6 text-lg text-gray-600">
                Find your perfect intern roommate match
              </p>
              <button
                onClick={() => signIn('google')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Sign in with Google
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
} 