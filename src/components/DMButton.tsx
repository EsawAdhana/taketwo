'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FiSend } from 'react-icons/fi';

interface DMButtonProps {
  userId: string;
  userName: string;
  userImage?: string;
}

export default function DMButton({ userId, userName, userImage }: DMButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const handleDM = async (e: React.MouseEvent) => {
    // Stop event propagation to prevent parent card onClick from firing
    e.stopPropagation();
    
    if (!session?.user) {
      // Handle not logged in state
      return;
    }

    setIsLoading(true);
    try {
      // Use emails for participants to avoid ID issues
      // The API will handle finding/converting these to proper IDs
      const participants = [session.user.email, userId];
      
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participants,
          isGroup: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create conversation: ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        router.push(`/messages/${result.data._id}`);
      } else {
        throw new Error('Failed to create conversation: No data returned');
      }
    } catch (error) {
      // Handle error state
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleDM}
      disabled={isLoading}
      className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full hover:from-purple-600 hover:to-pink-600 text-sm font-medium shadow-sm flex items-center transition-all duration-200"
    >
      <FiSend className="mr-1" /> DM
    </button>
  );
} 