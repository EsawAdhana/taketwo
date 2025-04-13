'use client';

import { SurveyFormData } from '@/constants/survey-constants';
import { useState, useEffect } from 'react';

interface TimingBudgetPageProps {
  formData: SurveyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SurveyFormData>>;
  setHasDateError?: (hasError: boolean) => void;
}

export default function TimingBudgetPage({ formData, setFormData, setHasDateError }: TimingBudgetPageProps) {
  const [dateError, setDateError] = useState<string>('');
  const [budgetError, setBudgetError] = useState<string>('');

  // Update parent component whenever dateError changes
  useEffect(() => {
    if (setHasDateError) {
      setHasDateError(!!dateError);
    }
  }, [dateError, setHasDateError]);

  const validateDates = () => {
    const { internshipStartDate, internshipEndDate } = formData;
    
    // Only validate if both dates are fully entered
    if (internshipStartDate && internshipEndDate) {
      if (new Date(internshipEndDate) < new Date(internshipStartDate)) {
        setDateError('End date cannot be before start date');
        return false;
      }
    }
    setDateError('');
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // No longer validating dates during onChange, moved to onBlur
    
    if (name === 'minBudget' || name === 'maxBudget') {
      // Parse as number explicitly to avoid any string conversion issues
      const minBudget = name === 'minBudget' ? parseInt(value, 10) : formData.minBudget;
      const maxBudget = name === 'maxBudget' ? parseInt(value, 10) : formData.maxBudget;
      
      if (minBudget > maxBudget) {
        setBudgetError('Maximum rent cannot be less than minimum rent');
        return;
      }
      setBudgetError('');
    }
    
    // For budget inputs, ensure we're setting a number value
    if (name === 'minBudget' || name === 'maxBudget') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleDateBlur = () => {
    validateDates();
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Housing Details</h2>
      
      {/* Housing Dates */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Start Date */}
        <div>
          <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="internshipStartDate">
            Housing Start Date
          </label>
          <div className="relative">
            <input
              type="date"
              id="internshipStartDate"
              name="internshipStartDate"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              value={formData.internshipStartDate}
              onChange={handleInputChange}
              onBlur={handleDateBlur}
              required
            />
          </div>
        </div>
        
        {/* End Date */}
        <div>
          <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="internshipEndDate">
            Housing End Date
          </label>
          <div className="relative">
            <input
              type="date"
              id="internshipEndDate"
              name="internshipEndDate"
              className={`w-full rounded-md border ${dateError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer`}
              value={formData.internshipEndDate}
              onChange={handleInputChange}
              onBlur={handleDateBlur}
              min={formData.internshipStartDate}
              required
            />
            {dateError && (
              <p className="mt-1 text-sm text-red-500">{dateError}</p>
            )}
          </div>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select your ideal move-in and move-out dates using the calendar</p>
      
      {/* Roommates and Budget */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Number of Roommates */}
        <div>
          <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="desiredRoommates">
            How many roommates are you looking for?
          </label>
          <select
            id="desiredRoommates"
            name="desiredRoommates"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={formData.desiredRoommates}
            onChange={handleInputChange}
            required
          >
            <option value="1" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">1 roommate</option>
            <option value="2" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">2 roommates</option>
            <option value="3" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">3 roommates</option>
            <option value="4+" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">4+ roommates</option>
          </select>
        </div>
        
        {/* Monthly Budget */}
        <div>
          <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="budgetRange">
            What's your monthly rent contribution range?
          </label>
          <div className="space-y-4">
            <div className="relative pt-6">
              <div className="absolute -top-1 left-0 right-0 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>$500</span>
                <span>$5000+</span>
              </div>
              <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-lg">
                <div
                  className="absolute h-full bg-blue-500 rounded-lg"
                  style={{
                    left: `${((formData.minBudget - 500) / (5000 - 500)) * 100}%`,
                    right: `${100 - ((formData.maxBudget - 500) / (5000 - 500)) * 100}%`
                  }}
                />
                <input
                  type="range"
                  id="minBudget"
                  name="minBudget"
                  min="500"
                  max="5000"
                  step="100"
                  value={formData.minBudget}
                  onChange={handleInputChange}
                  className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:shadow-md"
                  style={{ zIndex: 3 }}
                />
                <input
                  type="range"
                  id="maxBudget"
                  name="maxBudget"
                  min="500"
                  max="5000"
                  step="100"
                  value={formData.maxBudget}
                  onChange={handleInputChange}
                  className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:shadow-md"
                  style={{ zIndex: 4 }}
                />
              </div>
            </div>
            
            <div className="flex justify-between">
              <div>
                <label htmlFor="minBudget" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Min Budget
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 dark:text-gray-400 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    name="minBudget"
                    id="minBudgetInput"
                    min="500"
                    max={formData.maxBudget}
                    step="100"
                    value={formData.minBudget}
                    onChange={handleInputChange}
                    readOnly
                    className="focus:ring-blue-500 focus:border-blue-500 block w-32 pl-7 pr-3 py-2 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="maxBudget" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max Budget
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 dark:text-gray-400 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    name="maxBudget"
                    id="maxBudgetInput" 
                    min={formData.minBudget}
                    max="5000"
                    step="100"
                    value={formData.maxBudget}
                    onChange={handleInputChange}
                    readOnly
                    className="focus:ring-blue-500 focus:border-blue-500 block w-32 pl-7 pr-3 py-2 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
          {budgetError && (
            <p className="mt-1 text-sm text-red-500">{budgetError}</p>
          )}
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Enter the range you can contribute each month for your share of housing costs</p>
        </div>
      </div>
    </div>
  );
} 