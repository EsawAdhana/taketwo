'use client';

import { useState } from 'react';
import { HOUSING_REGIONS, SurveyFormData } from '@/constants/survey-constants';

interface LocationPageProps {
  formData: SurveyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SurveyFormData>>;
}

export default function LocationPage({ formData, setFormData }: LocationPageProps) {
  const [customCity, setCustomCity] = useState('');
  const [showCustomCityInput, setShowCustomCityInput] = useState(false);
  const availableCities: string[] = formData.housingRegion ? [...(HOUSING_REGIONS[formData.housingRegion as keyof typeof HOUSING_REGIONS] || [])] : [];
  
  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      housingCities: [] // Reset cities when region changes
    }));
  };
  
  const handleCityToggle = (city: string) => {
    setFormData(prev => {
      const cities = prev.housingCities.includes(city)
        ? prev.housingCities.filter(c => c !== city)
        : [...prev.housingCities, city];
      return { ...prev, housingCities: cities };
    });
  };
  
  const handleAddCustomCity = () => {
    if (!customCity.trim()) return;
    
    if (formData.housingCities.includes(customCity)) {
      alert('This city is already in your list');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      housingCities: [...prev.housingCities, customCity]
    }));
    
    setCustomCity('');
    setShowCustomCityInput(false);
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-900">Location Preferences</h2>
      
      {/* Housing Region */}
      <div>
        <label className="block mb-2 font-medium text-gray-900" htmlFor="housingRegion">
          Where are you looking to live? *
        </label>
        <select
          id="housingRegion"
          name="housingRegion"
          className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          value={formData.housingRegion}
          onChange={handleRegionChange}
          required
        >
          <option value="" disabled className="bg-white text-gray-900">Select a region</option>
          {Object.keys(HOUSING_REGIONS).map(region => (
            <option key={region} value={region} className="bg-white text-gray-900">{region}</option>
          ))}
        </select>
      </div>
      
      {/* City Selection */}
      {formData.housingRegion && (
        <div>
          {formData.housingRegion === 'Other' ? (
            <div>
              <label className="block mb-2 font-medium text-gray-900" htmlFor="otherLocation">
                Please specify your location: *
              </label>
              <input
                type="text"
                id="otherLocation"
                name="otherLocation"
                className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Enter your specific location"
                value={formData.housingCities[0] || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  housingCities: [e.target.value]
                }))}
                required
              />
            </div>
          ) : (
            <div>
              <p className="mb-2 font-medium text-gray-900">Select specific cities you're interested in: *</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {availableCities.map(city => (
                  <div key={city} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`city-${city}`}
                      checked={formData.housingCities.includes(city)}
                      onChange={() => handleCityToggle(city)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`city-${city}`} className="ml-2 text-gray-900">
                      {city}
                    </label>
                  </div>
                ))}
              </div>
              
              {/* Custom city input */}
              {showCustomCityInput ? (
                <div className="mt-4">
                  <label className="block mb-2 font-medium text-gray-900" htmlFor="customCity">
                    Add a custom city:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="customCity"
                      className="flex-1 rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Enter city name"
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomCity}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomCityInput(false);
                      setCustomCity('');
                    }}
                    className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCustomCityInput(true)}
                  className="mt-4 flex items-center text-blue-600 hover:text-blue-700"
                >
                  <span className="mr-1">+</span> Add another city not listed
                </button>
              )}
              
              {/* Display custom cities */}
              {formData.housingCities.filter(city => !availableCities.includes(city)).length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700">Your custom cities:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.housingCities.filter(city => !availableCities.includes(city)).map(city => (
                      <div
                        key={city}
                        className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                      >
                        {city}
                        <button
                          type="button"
                          onClick={() => handleCityToggle(city)}
                          className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Helper text */}
      <p className="text-sm text-gray-500">
        * Required fields
      </p>
    </div>
  );
} 