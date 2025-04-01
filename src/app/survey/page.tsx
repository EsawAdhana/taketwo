'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import MultiPageSurvey from '@/components/survey/MultiPageSurvey';

export default function SurveyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = searchParams.get('edit') === 'true';
  
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }
  
  if (!session) {
    router.push('/');
    return null;
  }
  
  return (
    <main className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          {isEditing ? 'Edit Your Preferences' : 'Internship Housing Survey'}
        </h1>
        <MultiPageSurvey 
          onSubmitSuccess={() => router.push('/dashboard')} 
          isEditing={isEditing}
        />
      </div>
    </main>
  );
} 