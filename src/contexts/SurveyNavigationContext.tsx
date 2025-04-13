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
      const shouldWarn = hasUnsavedChanges || (isSubmitted === true);
      console.log('Survey Navigation - Should warn?', {
        hasUnsavedChanges,
        isSubmitted,
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
        
        // Show confirmation dialog
        e.preventDefault();
        
        if (window.confirm("You have unsaved changes to your survey. Your changes will be lost if you leave without submitting. Do you want to continue?")) {
          // Proceed with navigation
          if (link.href.startsWith(window.location.origin)) {
            // For internal links
            const path = link.href.replace(window.location.origin, '');
            router.push(path);
          } else {
            // For external links
            window.location.href = link.href;
          }
        }
      }
      // If it's a button that might navigate
      else if (navigationElement.tagName === 'BUTTON') {
        // Skip disabled buttons
        if (navigationElement.hasAttribute('disabled') || navigationElement.classList.contains('disabled')) {
          return;
        }
        
        // If this button is not part of the survey form controls
        if (!navigationElement.closest('form')) {
          // Show warning for any button outside of the form
          e.preventDefault();
          e.stopPropagation();
          
          if (window.confirm("You have unsaved changes to your survey. Your changes will be lost if you leave without submitting. Do you want to continue?")) {
            // Let the original click handler proceed
            setShowWarningOnNavigation(false);
            setTimeout(() => {
              navigationElement.click();
            }, 0);
          }
        }
      }
    };
    
    // Use capture to intercept clicks before regular handlers
    document.addEventListener('click', handleClick, { capture: true });
    
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [showWarningOnNavigation, pathname, router]);
  
  // Add beforeunload event for browser navigation (back button, refresh)
  useEffect(() => {
    if (!showWarningOnNavigation) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // This text might not show in all browsers as they use their own messages,
      // but we set it anyway for browsers that do respect it
      e.returnValue = 'You have unsaved changes to your survey. Your changes will be lost if you leave without submitting.';
      return 'You have unsaved changes to your survey. Your changes will be lost if you leave without submitting.';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [showWarningOnNavigation]);
  
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