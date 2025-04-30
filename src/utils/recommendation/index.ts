// Types exports
export * from './types';

// Constants exports
export * from './constants';

// Helper functions
export { 
  documentToSurveyData,
  isUserBlocked,
  getUserSurveyData
} from './helpers';

// Constraints functions
export {
  passesHardConstraints,
  getConstraintDetails
} from './constraints';

// Scoring functions
export {
  calculatePreferenceScore,
  calculateBudgetScore,
  calculateCompatibilityScore
} from './scoring';

// Enhanced scoring functions
export { calculateEnhancedCompatibilityScore } from './enhanced-scoring';

// Analysis functions
export { analyzeAdditionalNotes } from './analysis';

// Recommendation functions
export {
  getRecommendedMatches,
  getTopMatchesByRegion,
  compareUsers
} from './recommendations';

// Debug functions
export { debugCompatibility } from './debug'; 