export const HOUSING_REGIONS = {
  "Bay Area": ["San Francisco", "Mountain View", "Menlo Park", "San Jose", "Palo Alto", "Sunnyvale", "Santa Clara"],
  "Seattle Area": ["Seattle", "Bellevue", "Redmond", "Kirkland"],
  "New York Area": ["Manhattan", "Brooklyn", "Queens"],
  "Other": []
} as const;

export type HousingRegion = keyof typeof HOUSING_REGIONS;
export type CityType = typeof HOUSING_REGIONS[HousingRegion][number];

export const NON_NEGOTIABLES = [
  "Okay with pets",
  "Okay with alcohol",
  "Okay with parties",
  "Okay with visitors",
  "Okay with visitors staying overnight",
  "LGBTQ+/Ally",
] as const;

export type NonNegotiable = typeof NON_NEGOTIABLES[number];

export type PreferenceStrength = "deal breaker" | "prefer not" | "neutral" | "prefer" | "must have";

export interface Preference {
  item: NonNegotiable;
  strength: PreferenceStrength;
}

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
  preferences: Preference[];
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
  preferences: [],
  additionalNotes: "",
  currentPage: 1,
  isDraft: false,
  isSubmitted: false
}; 