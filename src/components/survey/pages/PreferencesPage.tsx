'use client';

import { NON_NEGOTIABLES, SurveyFormData, Preference, PreferenceStrength, NonNegotiable } from '@/constants/survey-constants';

interface PreferencesPageProps {
  formData: SurveyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SurveyFormData>>;
}

export default function PreferencesPage({ formData, setFormData }: PreferencesPageProps) {
  const handlePreferenceChange = (item: NonNegotiable, strength: PreferenceStrength) => {
    setFormData(prev => {
      const existingPreferenceIndex = prev.preferences.findIndex(p => p.item === item);
      let newPreferences: Preference[];
      
      if (existingPreferenceIndex === -1) {
        // Add new preference
        newPreferences = [...prev.preferences, { item, strength }];
      } else {
        // Update existing preference
        newPreferences = [...prev.preferences];
        newPreferences[existingPreferenceIndex] = { item, strength };
      }
      
      return { ...prev, preferences: newPreferences };
    });
  };
  
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getStrengthValue = (item: NonNegotiable): PreferenceStrength => {
    const preference = formData.preferences.find(p => p.item === item);
    return preference?.strength || "neutral";
  };

  const getSliderValue = (strength: PreferenceStrength): number => {
    switch (strength) {
      case "deal breaker": return 0;
      case "prefer not": return 1;
      case "neutral": return 2;
      case "prefer": return 3;
      case "must have": return 4;
      default: return 2;
    }
  };

  const getStrengthFromValue = (value: number): PreferenceStrength => {
    switch (value) {
      case 0: return "deal breaker";
      case 1: return "prefer not";
      case 2: return "neutral";
      case 3: return "prefer";
      case 4: return "must have";
      default: return "neutral";
    }
  };

  const getFontStyles = (currentValue: number, position: number) => {
    if (currentValue === position) {
      // Calculate font weight: bolder at the edges, normal in the middle
      const weight = position === 0 || position === 4 ? 'font-bold' : 
                    position === 1 || position === 3 ? 'font-medium' : 
                    'font-normal';
      
      return `${weight} text-sm text-gray-900 dark:text-gray-100`;
    }
    return 'text-sm text-gray-500';
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Preferences</h2>
        <p className="mt-1 text-sm text-gray-500">This information will be visible to potential roommates to help find better matches</p>
      </div>
      
      {/* Preferences with sliders */}
      <div>
        <div className="space-y-8">
          {NON_NEGOTIABLES.map(item => {
            const currentValue = getSliderValue(getStrengthValue(item));
            return (
              <div key={item} className="space-y-3">
                <label className="block text-gray-900 dark:text-gray-100">
                  {item}
                </label>
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max="4"
                    value={currentValue}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      const strength = getStrengthFromValue(value);
                      handlePreferenceChange(item, strength);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>
                <div className="flex justify-between">
                  <span className={getFontStyles(currentValue, 0)}>Deal breaker</span>
                  <span className={getFontStyles(currentValue, 1)}>Prefer not</span>
                  <span className={getFontStyles(currentValue, 2)}>Neutral</span>
                  <span className={getFontStyles(currentValue, 3)}>Prefer</span>
                  <span className={getFontStyles(currentValue, 4)}>Must have</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Additional Notes */}
      <div>
        <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="additionalNotes">
          Additional Notes or Preferences
        </label>
        <textarea
          id="additionalNotes"
          name="additionalNotes"
          rows={4}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          value={formData.additionalNotes}
          onChange={handleNotesChange}
          placeholder="Feel free to add any additional preferences, lifestyle habits, or other information that might help find compatible roommates"
        />
      </div>
    </div>
  );
} 