'use client';

import { SurveyFormData } from '@/constants/survey-constants';
import { useState } from 'react';

interface TimingBudgetPageProps {
  formData: SurveyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SurveyFormData>>;
}

export default function TimingBudgetPage({ formData, setFormData }: TimingBudgetPageProps) {
  const [dateError, setDateError] = useState<string>('');
  const [budgetError, setBudgetError] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'internshipStartDate' || name === 'internshipEndDate') {
      const startDate = name === 'internshipStartDate' ? value : formData.internshipStartDate;
      const endDate = name === 'internshipEndDate' ? value : formData.internshipEndDate;
      
      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        setDateError('End date cannot be before start date');
        return;
      }
      setDateError('');
    }
    
    if (name === 'minBudget' || name === 'maxBudget') {
      const minBudget = name === 'minBudget' ? Number(value) : formData.minBudget;
      const maxBudget = name === 'maxBudget' ? Number(value) : formData.maxBudget;
      
      if (minBudget > maxBudget) {
        setBudgetError('Minimum budget cannot be greater than maximum budget');
        return;
      }
      setBudgetError('');
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Timing & Budget</h2>
      
      {/* Internship Dates */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Start Date */}
        <div>
          <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="internshipStartDate">
            Internship Start Date *
          </label>
          <input
            type="date"
            id="internshipStartDate"
            name="internshipStartDate"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={formData.internshipStartDate}
            onChange={handleInputChange}
            required
          />
        </div>
        
        {/* End Date */}
        <div>
          <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="internshipEndDate">
            Internship End Date *
          </label>
          <input
            type="date"
            id="internshipEndDate"
            name="internshipEndDate"
            className={`w-full rounded-md border ${dateError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            value={formData.internshipEndDate}
            onChange={handleInputChange}
            min={formData.internshipStartDate}
            required
          />
          {dateError && (
            <p className="mt-1 text-sm text-red-500">{dateError}</p>
          )}
        </div>
      </div>
      
      {/* Roommates and Budget */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Number of Roommates */}
        <div>
          <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="desiredRoommates">
            How many roommates are you looking for? *
          </label>
          <select
            id="desiredRoommates"
            name="desiredRoommates"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={formData.desiredRoommates}
            onChange={handleInputChange}
            required
          >
            <option value="1">1 roommate</option>
            <option value="2">2 roommates</option>
            <option value="3">3 roommates</option>
            <option value="4+">4+ roommates</option>
          </select>
        </div>
        
        {/* Monthly Budget */}
        <div>
          <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="minBudget">
            What is YOUR monthly budget range? *
          </label>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                id="minBudget"
                name="minBudget"
                min="0"
                step="100"
                placeholder="Min"
                className={`w-full rounded-md border ${budgetError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 p-2 pl-8 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                value={formData.minBudget}
                onChange={handleInputChange}
                required
              />
            </div>
            <span className="text-gray-500">to</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                id="maxBudget"
                name="maxBudget"
                min={formData.minBudget}
                step="100"
                placeholder="Max"
                className={`w-full rounded-md border ${budgetError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 p-2 pl-8 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                value={formData.maxBudget}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          {budgetError && (
            <p className="mt-1 text-sm text-red-500">{budgetError}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">Enter the range you can contribute each month for your share of housing costs</p>
        </div>
      </div>
      
      {/* Helper text */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        * Required fields
      </p>
    </div>
  );
} 