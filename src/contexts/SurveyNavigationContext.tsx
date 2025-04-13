'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useSurveyStatus from '@/hooks/useSurveyStatus';

interface SurveyNavigationContextType {
  showWarningOnNavigation: boolean;
  setShowWarningOnNavigation: React.Dispatch<React.SetStateAction<boolean>>;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
}

const SurveyNavigationContext = createContext<SurveyNavigationContextType | undefined>(undefined);

export function SurveyNavigationProvider({ children }: { children: React.ReactNode }) {
  const [showWarningOnNavigation, setShowWarningOnNavigation] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isSubmitted, loading } = useSurveyStatus();
  
  // Automatically enable warning when in a survey path and either:
  // 1. The user explicitly has unsaved changes, or
  // 2. The user is revisiting a previously submitted survey
  useEffect(() => {
    if (pathname.includes('/survey')) {
      // Only enable the warning if there are explicit unsaved changes
      const shouldWarn = hasUnsavedChanges;
      console.log('Survey Navigation - Should warn?', {
        hasUnsavedChanges,
        isSubmitted, // Still log isSubmitted for context, but don't use it for the warning condition
        shouldWarn,
        pathname
      });
      setShowWarningOnNavigation(shouldWarn);
    } else {
      setShowWarningOnNavigation(false);
    }
  }, [pathname, hasUnsavedChanges, isSubmitted, loading]);
  
  // Set up a global click interceptor for navigation
  useEffect(() => {
    if (!showWarningOnNavigation) return;
    
    const handleClick = (e: MouseEvent) => {
      if (!e.target || !(e.target instanceof HTMLElement)) return;
      
      // Find if the click is on an anchor tag or inside one
      const findClickTarget = (element: HTMLElement | null): HTMLElement | null => {
        if (!element) return null;
        if (element.tagName === 'A' || element.tagName === 'BUTTON') {
          return element;
        }
        return element.parentElement ? findClickTarget(element.parentElement) : null;
      };
      
      const navigationElement = findClickTarget(e.target as HTMLElement);
      
      if (!navigationElement) return;
      
      // Skip internal survey navigation (Next, Back, Submit Survey buttons)
      // These buttons should have specific classes in the survey form
      if (pathname.includes('/survey')) {
        const isInternalNavigation = 
          // Check if it's one of our own navigation buttons
          (navigationElement.textContent?.includes('Next') ||
           navigationElement.textContent?.includes('Back') ||
           navigationElement.textContent?.includes('Submit Survey') ||
           navigationElement.textContent?.includes('Save Changes')) &&
          // And it's within a form
          navigationElement.closest('form') !== null;
        
        if (isInternalNavigation) {
          return;
        }
      }
      
      // If it's an anchor tag with href
      if (navigationElement.tagName === 'A') {
        const link = navigationElement as HTMLAnchorElement;
        if (!link.href || link.href.includes('#') || link.target === '_blank') return;
        
        // Skip if it's linking to the current page
        if (link.href.includes(pathname)) return;

        // Check if we need to show a warning
        const targetPath = link.href.replace(window.location.origin, '');
        const restrictedPaths = ['/dashboard', '/messages', '/settings'];
        
        if (showWarningOnNavigation && restrictedPaths.includes(targetPath)) {
          const confirmationMessage = "You have unsaved changes. Are you sure you want to leave? Your changes will be lost.";
          if (!window.confirm(confirmationMessage)) {
            e.preventDefault(); // Prevent navigation
            e.stopImmediatePropagation(); // Stop other listeners
            return; // Stop execution
          }
        }
        
        // Proceed with navigation
        if (link.href.startsWith(window.location.origin)) {
          // For internal links, prevent default and use router
          e.preventDefault(); 
          router.push(targetPath);
        } 
        // For external links, do NOT prevent default, let the browser handle it.
      }
      // If it's a button that might navigate
      else if (navigationElement.tagName === 'BUTTON') {
        // Skip disabled buttons
        if (navigationElement.hasAttribute('disabled') || navigationElement.classList.contains('disabled')) {
          return;
        }

        // Check if we need to show a warning for button-based navigation (e.g., settings or messages could potentially use buttons)
        // This part might need adjustment depending on how your buttons trigger navigation.
        // For now, we assume buttons that navigate away from the survey page will also trigger the warning if needed.
        // Let's focus on the common case: the Sign Out button
        if (navigationElement.textContent?.includes('Sign Out')) {
          if (showWarningOnNavigation) {
            const confirmationMessage = "You have unsaved changes. Are you sure you want to sign out? Your changes will be lost.";
            if (!window.confirm(confirmationMessage)) {
              e.preventDefault(); // Prevent the default action (like form submission if inside one)
              e.stopImmediatePropagation(); // Stop other listeners
              return; // Stop execution
            }
          }
          // If confirmed or no warning needed, let the button's original onClick handler proceed (handled by Navigation.tsx)
          return; 
        }
        
        // If this button is not part of the survey form controls and not the sign out button,
        // let its click handler proceed without interference from this context.
      }
    };
    
    // Use capture to intercept clicks before regular handlers
    document.addEventListener('click', handleClick, { capture: true });
    
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [showWarningOnNavigation, pathname, router]);
  
  return (
    <SurveyNavigationContext.Provider value={{ 
      showWarningOnNavigation, 
      setShowWarningOnNavigation,
      hasUnsavedChanges,
      setHasUnsavedChanges
    }}>
      {children}
    </SurveyNavigationContext.Provider>
  );
}

export function useSurveyNavigation() {
  const context = useContext(SurveyNavigationContext);
  if (context === undefined) {
    throw new Error('useSurveyNavigation must be used within a SurveyNavigationProvider');
  }
  return context;
} 