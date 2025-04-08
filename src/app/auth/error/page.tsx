'use client';

import { useSearchParams } from 'next/navigation';

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">
          Access Denied
        </h1>
        
        <div className="text-gray-700 space-y-4">
          <p>
            Your account has been permanently banned due to multiple reports from other users.
          </p>
          <p>
            This decision is final and you will not be able to access MonkeyHouse services.
          </p>
          {error && (
            <p className="text-sm text-gray-500 mt-4">
              Error code: {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
} 