import { NotesAnalysisResult } from './types';

/**
 * Analyze additional notes from two users to determine compatibility
 * Returns a score between -10 and +10 and an explanation
 *  -10: Completely incompatible lifestyles
 *   0: Neutral
 *  +10: Highly compatible lifestyles
 */
export async function analyzeAdditionalNotes(
  notes1: string, 
  notes2: string
): Promise<NotesAnalysisResult> {
  // Skip if either user doesn't have additional notes
  if (!notes1 || !notes2 || notes1.trim() === '' || notes2.trim() === '') {
    return { 
      score: 0, 
      explanation: "One or both users didn't provide additional notes." 
    }; // Neutral if no notes to compare
  }
  
  try {
    // Make a fetch request to our API endpoint instead of calling OpenAI directly
    // This works in both client and server contexts
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'analyze_compatibility',
        notes1,
        notes2
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const result = await response.json();
    
    return {
      score: result.score || 0,
      explanation: result.explanation || "No explanation provided by compatibility analysis."
    };
  } catch (error) {
    console.error('Error analyzing additional notes:', error);
    return { 
      score: 0, 
      explanation: "Error occurred during compatibility analysis. Please try again later." 
    };
  }
} 