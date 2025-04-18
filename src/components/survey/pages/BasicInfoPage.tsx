'use client';

import { SurveyFormData } from '@/constants/survey-constants';
import { useState } from 'react';

interface BasicInfoPageProps {
  formData: SurveyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SurveyFormData>>;
}

export default function BasicInfoPage({ formData, setFormData }: BasicInfoPageProps) {
  const [nameError, setNameError] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear name error if value is not empty
    if (name === 'firstName' && value.trim()) {
      setNameError('');
    }
  };
  
  const validateFirstName = (value: string) => {
    if (!value.trim()) {
      setNameError('First name is required');
      return false;
    }
    setNameError('');
    return true;
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };
  
  return (
    <div className="space-y-4">
      {/* Privacy Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Please note that the information you provide in this survey will be visible to other users.
        </p>
      </div>
      
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Basic Information</h2>
      
      {/* First Name */}
      <div>
        <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="firstName">
          What is your first name?
        </label>
        <input
          type="text"
          id="firstName"
          name="firstName"
          className={`w-full rounded-md border ${
            nameError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
          value={formData.firstName}
          onChange={handleInputChange}
          onBlur={(e) => validateFirstName(e.target.value)}
          required
          placeholder="Enter your first name"
          aria-required="true"
        />
        {nameError && (
          <p className="mt-1 text-sm text-red-500">{nameError}</p>
        )}
      </div>
      
      {/* Gender Selection */}
      <div>
        <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="gender">
          What is your gender?
        </label>
        <select
          id="gender"
          name="gender"
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          value={formData.gender}
          onChange={handleInputChange}
          required
        >
          <option value="" disabled>Select your gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Non-Binary">Non-Binary</option>
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
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="roomWithDifferentGender" className="text-gray-900 dark:text-gray-100">
          I am willing to room with someone of a different gender
        </label>
      </div>
      
      {/* Internship Company */}
      <div>
        <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="internshipCompany">
          Internship Company
        </label>
        <input
          type="text"
          id="internshipCompany"
          name="internshipCompany"
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          value={formData.internshipCompany}
          onChange={handleInputChange}
          placeholder="Where will you be interning?"
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Optional: Sharing your company can help match with other interns from the same workplace</p>
      </div>
    </div>
  );
} 