import OpenAI from 'openai';

// Define a function to create the OpenAI client
// This ensures the code only executes on the server
const createOpenAIClient = () => {
  // Check if we have an API key
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    // In development, log a warning but don't throw an error
    console.warn('⚠️ OpenAI API key is missing. API calls will fail.');
  }
  
  // Return a new OpenAI instance
  return new OpenAI({
    apiKey: apiKey || 'dummy-key-for-client', // Provide fallback to prevent client-side crashes
  });
};

// Only initialize on the server side
const openai = typeof window === 'undefined' ? createOpenAIClient() : null;

// Export as a singleton instance
export default openai; 