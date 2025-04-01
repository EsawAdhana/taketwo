'use client';

import { SurveyFormData } from '@/constants/survey-constants';

interface BasicInfoPageProps {
  formData: SurveyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SurveyFormData>>;
}

export default function BasicInfoPage({ formData, setFormData }: BasicInfoPageProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Basic Information</h2>
      
      {/* Gender Selection */}
      <div>
        <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="gender">
          What is your gender? *
        </label>
        <select
          id="gender"
          name="gender"
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          value={formData.gender}
          onChange={handleInputChange}
          required
        >
          <option value="" disabled>Select your gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Non-Binary">Non-Binary</option>
          <option value="Prefer not to say">Prefer not to say</option>
        </select>
      </div>
      
      {/* Room with different gender preference */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="roomWithDifferentGender"
          name="roomWithDifferentGender"
          checked={formData.roomWithDifferentGender}
          onChange={handleCheckboxChange}
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
        <label htmlFor="roomWithDifferentGender" className="text-gray-900 dark:text-gray-100">
          I am willing to room with someone of a different gender
        </label>
      </div>
      
      {/* Helper text */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
        * Required fields
      </p>
    </div>
  );
} 