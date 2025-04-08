'use client';

import { NON_NEGOTIABLES, SurveyFormData, Preference, PreferenceStrength, NonNegotiable } from '@/constants/survey-constants';
import { useState } from 'react';

interface PreferencesPageProps {
  formData: SurveyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SurveyFormData>>;
}

export default function PreferencesPage({ formData, setFormData }: PreferencesPageProps) {
  const [notesError, setNotesError] = useState<string>('');
  // Define preference options
  const PREFERENCE_OPTIONS: Array<{value: PreferenceStrength, label: string}> = [
    { value: "deal breaker", label: 'Deal breaker' },
    { value: "prefer not", label: 'Prefer not' },
    { value: "neutral", label: 'Neutral' },
    { value: "prefer", label: 'Prefer' },
    { value: "must have", label: 'Must have' }
  ];

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

  const getPreferenceStrength = (item: NonNegotiable): PreferenceStrength => {
    const preference = formData.preferences.find(p => p.item === item);
    return preference ? preference.strength : "neutral"; // Default to neutral
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Preferences</h2>
        <p className="mt-1 text-sm text-gray-500">This information will be visible to potential roommates to help find better matches</p>
      </div>
      
      {/* Preferences with radio buttons */}
      <div className="space-y-4">
        {NON_NEGOTIABLES.map(item => {
          const currentStrength = getPreferenceStrength(item);
          return (
            <div key={item} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
              <label className="block text-gray-900 dark:text-gray-100 font-medium">
                {item}
              </label>
              <div className="grid grid-cols-5 gap-2">
                {PREFERENCE_OPTIONS.map((option) => (
                  <div key={option.value} className="flex flex-col items-center">
                    <input
                      type="radio"
                      id={`${item}-${option.value}`}
                      name={`preference-${item}`}
                      className="w-4 h-4 mb-3"
                      checked={currentStrength === option.value}
                      onChange={() => handlePreferenceChange(item, option.value)}
                    />
                    <label 
                      htmlFor={`${item}-${option.value}`}
                      className={`text-sm text-center ${
                        currentStrength === option.value 
                          ? 'text-gray-900 dark:text-gray-100 font-medium' 
                          : 'text-gray-500'
                      }`}
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
          className={`w-full rounded-md border ${
            notesError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
          value={formData.additionalNotes}
          onChange={handleNotesChange}
          placeholder="Feel free to add any additional preferences, lifestyle habits, or other information that might help find compatible roommates"
        />
        {notesError && (
          <p className="mt-1 text-sm text-red-500">{notesError}</p>
        )}
      </div>
    </div>
  );
} 