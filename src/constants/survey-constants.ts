export const HOUSING_REGIONS = {
  "Bay Area": ["San Francisco", "Mountain View", "Menlo Park", "San Jose", "Palo Alto", "Sunnyvale", "Santa Clara"],
  "Seattle Area": ["Seattle", "Bellevue", "Redmond", "Kirkland"],
  "New York Area": ["Manhattan", "Brooklyn", "Queens"],
  "Other": []
} as const;

export type HousingRegion = keyof typeof HOUSING_REGIONS;
export type CityType = typeof HOUSING_REGIONS[HousingRegion][number];

export const NON_NEGOTIABLES = [
  "No smoking",
  "No pets",
  "No alcohol",
  "No parties",
  "Clean common areas",
  "Quiet hours",
  "Early riser",
  "Night owl"
] as const;

export type NonNegotiable = typeof NON_NEGOTIABLES[number];

export interface SurveyFormData {
  // Page 1: Basic Info
  gender: string;
  roomWithDifferentGender: boolean;
  
  // Page 2: Location
  housingRegion: HousingRegion | "";
  housingCities: string[];
  
  // Page 3: Timing & Budget
  internshipStartDate: string;
  internshipEndDate: string;
  desiredRoommates: string;
  monthlyBudget: number;
  
  // Page 4: Preferences
  nonNegotiables: NonNegotiable[];
  additionalNotes: string;
  
  // Form state
  currentPage: number;
  isDraft: boolean;
  isSubmitted: boolean;
}

export const INITIAL_FORM_DATA: SurveyFormData = {
  gender: "",
  roomWithDifferentGender: false,
  housingRegion: "",
  housingCities: [],
  internshipStartDate: "",
  internshipEndDate: "",
  desiredRoommates: "1",
  monthlyBudget: 1500,
  nonNegotiables: [],
  additionalNotes: "",
  currentPage: 1,
  isDraft: false,
  isSubmitted: false
}; 