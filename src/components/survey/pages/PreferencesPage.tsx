'use client';

import { NON_NEGOTIABLES, SurveyFormData } from '@/constants/survey-constants';

interface PreferencesPageProps {
  formData: SurveyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SurveyFormData>>;
}

export default function PreferencesPage({ formData, setFormData }: PreferencesPageProps) {
  const handleNonNegotiableToggle = (item: string) => {
    setFormData(prev => {
      const nonNegotiables = prev.nonNegotiables.includes(item)
        ? prev.nonNegotiables.filter(i => i !== item)
        : [...prev.nonNegotiables, item];
      return { ...prev, nonNegotiables };
    });
  };
  
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Preferences</h2>
      
      {/* Non-negotiables */}
      <div>
        <p className="mb-2 font-medium text-gray-900 dark:text-gray-100">Select your non-negotiables:</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {NON_NEGOTIABLES.map(item => (
            <div key={item} className="flex items-center">
              <input
                type="checkbox"
                id={`non-negotiable-${item}`}
                checked={formData.nonNegotiables.includes(item)}
                onChange={() => handleNonNegotiableToggle(item)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <label htmlFor={`non-negotiable-${item}`} className="ml-2 text-gray-900 dark:text-gray-100">
                {item}
              </label>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500">Select any absolute requirements you have for your living situation</p>
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
          placeholder="Any other preferences or information you'd like to share..."
        />
        <p className="mt-1 text-sm text-gray-500">
          Feel free to add any additional preferences, lifestyle habits, or other information that might help find compatible roommates
        </p>
      </div>
    </div>
  );
} 