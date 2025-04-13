'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function useSurveyStatus() {
  const { data: session } = useSession();
  const [isSubmitted, setIsSubmitted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSurveyStatus = async () => {
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/survey');
        const result = await response.json();
        
        if (response.ok && result.data) {
          setIsSubmitted(result.data.isSubmitted || false);
        } else {
          setIsSubmitted(false);
        }
      } catch (error) {
        console.error('Error fetching survey status:', error);
        setIsSubmitted(false);
      } finally {
        setLoading(false);
      }
    };

    fetchSurveyStatus();
  }, [session]);

  return { isSubmitted, loading };
} 