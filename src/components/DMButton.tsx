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

  const handleDM = async () => {
    if (!session?.user) {
      // Handle not logged in state
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participants: [session.user.id, userId],
          isGroup: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const conversation = await response.json();
      router.push(`/messages/${conversation._id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
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