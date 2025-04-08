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
      <h2 className="text-2xl font-semibold text-gray-900">Timing & Budget</h2>
      
      {/* Internship Dates */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Start Date */}
        <div>
          <label className="block mb-2 font-medium text-gray-900" htmlFor="internshipStartDate">
            Internship Start Date *
          </label>
          <input
            type="date"
            id="internshipStartDate"
            name="internshipStartDate"
            className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={formData.internshipStartDate}
            onChange={handleInputChange}
            required
          />
        </div>
        
        {/* End Date */}
        <div>
          <label className="block mb-2 font-medium text-gray-900" htmlFor="internshipEndDate">
            Internship End Date *
          </label>
          <input
            type="date"
            id="internshipEndDate"
            name="internshipEndDate"
            className={`w-full rounded-md border ${dateError ? 'border-red-500' : 'border-gray-300'} bg-white p-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
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
          <label className="block mb-2 font-medium text-gray-900" htmlFor="desiredRoommates">
            How many roommates are you looking for? *
          </label>
          <select
            id="desiredRoommates"
            name="desiredRoommates"
            className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={formData.desiredRoommates}
            onChange={handleInputChange}
            required
          >
            <option value="1" className="bg-white text-gray-900">1 roommate</option>
            <option value="2" className="bg-white text-gray-900">2 roommates</option>
            <option value="3" className="bg-white text-gray-900">3 roommates</option>
            <option value="4+" className="bg-white text-gray-900">4+ roommates</option>
          </select>
        </div>
        
        {/* Monthly Budget */}
        <div>
          <label className="block mb-2 font-medium text-gray-900" htmlFor="budgetRange">
            What is YOUR monthly budget range? *
          </label>
          <div className="space-y-4">
            <div className="relative pt-6">
              <div className="absolute -top-1 left-0 right-0 flex justify-between text-xs text-gray-500">
                <span>$500</span>
                <span>$5000+</span>
              </div>
              <div className="relative h-2 bg-gray-200 rounded-lg">
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
            <div className="flex justify-between items-center">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  readOnly
                  className="w-full rounded-md border border-gray-300 bg-gray-50 p-2 pl-8 text-gray-900"
                  value={formData.minBudget.toLocaleString()}
                />
              </div>
              <span className="mx-4 text-gray-500">to</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  readOnly
                  className="w-full rounded-md border border-gray-300 bg-gray-50 p-2 pl-8 text-gray-900"
                  value={formData.maxBudget.toLocaleString()}
                />
              </div>
            </div>
          </div>
          {budgetError && (
            <p className="mt-1 text-sm text-red-500">{budgetError}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">Enter the range you can contribute each month for your share of housing costs</p>
        </div>
      </div>
      
      {/* Helper text */}
      <p className="text-sm text-gray-500">
        * Required fields
      </p>
    </div>
  );
} 