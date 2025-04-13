'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import MultiPageSurvey from '@/components/survey/MultiPageSurvey';
import { useEffect } from 'react';

export default function SurveyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = searchParams.get('edit') === 'true';
  
  // Function to handle successful survey submission
  const handleSurveySuccess = () => {
    console.log('Survey submitted successfully, navigating to dashboard...');
    
    // Use multiple navigation methods to ensure redirection works
    try {
      router.push('/dashboard');
    } catch (e) {
      console.error('Router push failed:', e);
    }
    
    // Fallback navigation methods
    setTimeout(() => {
      try {
        window.location.href = '/dashboard';
      } catch (e) {
        console.error('Location redirect failed:', e);
      }
    }, 300);
  };
  
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }
  
  if (!session) {
    router.push('/');
    return null;
  }
  
  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 py-4 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">
          {isEditing ? 'Edit Your Preferences' : 'Internship Housing Survey'}
        </h1>
        <MultiPageSurvey 
          onSubmitSuccess={handleSurveySuccess} 
          isEditing={isEditing}
        />
      </div>
    </main>
  );
} 