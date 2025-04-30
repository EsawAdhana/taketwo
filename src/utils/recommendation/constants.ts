import { PreferenceStrength } from '@/constants/survey-constants';

/**
 * Constants for scoring weights
 */
export const WEIGHTS = {
  LOCATION: 30,
  BUDGET: 25,
  TIMING: 25,
  PREFERENCES: 20
};

/**
 * Budget tolerance (as a percentage)
 */
export const BUDGET_TOLERANCE = 0.2; // 20%

/**
 * Preference strength value mapping
 */
export const PREFERENCE_VALUES: Record<PreferenceStrength, number> = {
  'deal breaker': -4,
  'prefer not': -1,
  'neutral': 0,
  'prefer': 1,
  'must have': 4
};

/**
 * Default minimum compatibility threshold
 */
export const DEFAULT_MIN_COMPATIBILITY_THRESHOLD = 50; 