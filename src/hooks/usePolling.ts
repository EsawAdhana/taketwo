import { useEffect, useRef, useState } from 'react';

interface UsePollingOptions {
  // Function to call on each polling interval
  pollingFunction: () => Promise<void>;
  // Initial polling interval in milliseconds
  initialInterval?: number;
  // Maximum polling interval when using backoff
  maxInterval?: number;
  // Backoff multiplier for consecutive errors
  backoffMultiplier?: number;
  // Timeout for each request in milliseconds
  requestTimeout?: number;
  // Whether to start polling immediately
  enabled?: boolean;
}

export function usePolling({
  pollingFunction,
  initialInterval = 3000,
  maxInterval = 30000,
  backoffMultiplier = 1.5,
  requestTimeout = 3000,
  enabled = true
}: UsePollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [currentInterval, setCurrentInterval] = useState(initialInterval);
  const errorCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Function to execute a single polling cycle
  const executePoll = async () => {
    // Skip if already polling or disabled
    if (isPolling || !enabled) return;

    try {
      setIsPolling(true);
      
      // Create abort controller for timeout
      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, requestTimeout);

      // Call the polling function
      await pollingFunction();
      
      // Reset error count on success
      errorCountRef.current = 0;
      // Reset polling interval on success
      if (currentInterval !== initialInterval) {
        setCurrentInterval(initialInterval);
        resetInterval();
      }
    } catch (error) {
      // Handle errors
      handleError(error);
    } finally {
      // Clean up timeout
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
      setIsPolling(false);
    }
  };

  // Function to handle polling errors
  const handleError = (error: any) => {
    // Increment error count
    errorCountRef.current++;
    
    // Only log unexpected errors
    if (!(error instanceof DOMException && error.name === 'AbortError') &&
        navigator.onLine &&
        !(error instanceof TypeError && error.message.includes('Failed to fetch'))) {
      console.error('Polling error:', error);
    }
    
    // Calculate backoff interval
    if (errorCountRef.current > 0) {
      const newInterval = Math.min(
        initialInterval * Math.pow(backoffMultiplier, errorCountRef.current - 1),
        maxInterval
      );
      
      if (newInterval !== currentInterval) {
        setCurrentInterval(newInterval);
        resetInterval();
      }
    }
  };

  // Function to reset the interval with the current interval value
  const resetInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(executePoll, currentInterval);
    }
  };

  // Start polling
  const startPolling = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Execute immediately
    executePoll();
    
    // Set up interval
    intervalRef.current = setInterval(executePoll, currentInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  };

  // Set up and clean up polling
  useEffect(() => {
    if (!enabled) {
      // Clean up if disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    const cleanup = startPolling();
    
    return () => {
      cleanup();
    };
  }, [enabled]);

  // Return the current polling state and control functions
  return {
    isPolling,
    currentInterval,
    startPolling,
    stopPolling: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    },
    abortController: abortControllerRef.current
  };
} 