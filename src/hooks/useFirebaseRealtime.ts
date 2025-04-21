import { useEffect, useState, useRef, useCallback } from 'react';
import { onSnapshot, Query, DocumentData, DocumentReference } from 'firebase/firestore';

type SubscriptionType = 'query' | 'document';

interface UseFirebaseRealtimeOptions<T> {
  enabled?: boolean;
  subscriptionType: SubscriptionType;
  target: Query<DocumentData> | DocumentReference<DocumentData>;
  onData?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useFirebaseRealtime<T>({
  enabled = true,
  subscriptionType,
  target,
  onData,
  onError
}: UseFirebaseRealtimeOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // Store callbacks in refs to avoid dependency issues
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onDataRef.current = onData;
    onErrorRef.current = onError;
  }, [onData, onError]);

  const subscribe = useCallback(() => {
    if (!enabled || !target) return;

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = onSnapshot(
        target,
        (snapshot) => {
          let result: any;

          if (subscriptionType === 'query') {
            // Handle collection query
            const items: DocumentData[] = [];
            snapshot.forEach((doc) => {
              items.push({
                _id: doc.id,
                ...doc.data()
              });
            });
            result = items as T;
          } else {
            // Handle single document
            if (snapshot.exists()) {
              result = {
                _id: snapshot.id,
                ...snapshot.data()
              } as T;
            } else {
              result = null;
            }
          }

          setData(result);
          setLoading(false);
          // Use the ref to access the current callback
          onDataRef.current?.(result);
        },
        (err) => {
          console.error('Firebase real-time subscription error:', err);
          setError(err);
          setLoading(false);
          // Use the ref to access the current callback
          onErrorRef.current?.(err);
        }
      );

      unsubscribeRef.current = unsubscribe;
      return unsubscribe;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Error setting up Firebase subscription:', error);
      setError(error);
      setLoading(false);
      // Use the ref to access the current callback
      onErrorRef.current?.(error);
      return () => {};
    }
  }, [enabled, target, subscriptionType]); // Remove onData and onError from dependencies

  useEffect(() => {
    const unsubscribe = subscribe();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [subscribe]);

  return {
    data,
    loading,
    error,
    refresh: subscribe,
  };
} 