'use client';

import { SurveyFormData } from '@/constants/survey-constants';

interface TimingBudgetPageProps {
  formData: SurveyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SurveyFormData>>;
}

export default function TimingBudgetPage({ formData, setFormData }: TimingBudgetPageProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
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
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={formData.internshipEndDate}
            onChange={handleInputChange}
            required
          />
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
          <label className="block mb-2 font-medium text-gray-900 dark:text-gray-100" htmlFor="monthlyBudget">
            What is your monthly budget? ($ per month) *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              id="monthlyBudget"
              name="monthlyBudget"
              min="0"
              step="100"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 pl-8 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={formData.monthlyBudget}
              onChange={handleInputChange}
              required
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">Enter your maximum monthly budget for housing</p>
        </div>
      </div>
      
      {/* Helper text */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        * Required fields
      </p>
    </div>
  );
} 