import OpenAI from 'openai';

// Initialize the OpenAI client (this runs server-side only)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, prompt, notes1, notes2 } = req.body;
    
    // General purpose completions endpoint
    if (action === 'completion' && prompt) {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      });
      
      return res.status(200).json({ result: response.choices[0].message.content });
    }
    
    // Compatibility analysis endpoint
    if (action === 'analyze_compatibility' && notes1 && notes2) {
      // Skip if either user doesn't have additional notes
      if (!notes1.trim() || !notes2.trim()) {
        return res.status(200).json({ 
          score: 0, 
          explanation: "One or both users didn't provide additional notes." 
        });
      }
      
      const prompt = `
      You are an AI roommate compatibility analyzer.
      You'll be given the "Additional Notes" sections of two potential roommates.
      They have already passed the hard constraints, so these individuals are already vaguely compatible.
      In the Additional Notes section, users provided whatever additional information they felt would be necessary to mention.
      
      Roommate 1: "${notes1}"
      
      Roommate 2: "${notes2}"
      
      ANALYSIS INSTRUCTIONS:
      1. Extract relevant information from each roommate's notes into these primary categories:
         - Sleep schedule
         - Noise tolerance
         - Kitchen habits
         - Cleaning expectations
         - Socializing style
         - Guest policy preferences
         - And any other relevant lifestyle factors mentioned
      
      2. For each relevant category that has information, assign a mini-score:
         -2: Direct conflict that would cause significant issues
         -1: Mild conflict or friction point
         +1: Generally compatible preferences
         +2: Highly complementary or matching preferences
      
      3. IMPORTANT: Calculate a final numerical compatibility score between -10 and +10.
         - DO NOT return a score of 0 by default
         - Even with limited information, you must lean either positive or negative
         - A perfectly neutral 0 score should be extremely rare
      
      4. Use this scoring guideline:
         -10 to -7: Extremely incompatible lifestyles
         -6 to -3: Several notable conflicts that would cause tension
         -2 to -1: Minor conflicts that could be worked through
         +1 to +2: Slightly compatible with more positives than negatives
         +3 to +6: Good compatibility with complementary lifestyles
         +7 to +10: Exceptionally compatible lifestyles
      
      5. Score calculation rules:
         - Critical conflicts in daily habits (sleep, noise, cleanliness) should heavily impact the score
         - Multiple minor conflicts should result in a negative score
         - Matching or complementary traits in important areas should result in a positive score
         - ANY potential dealbreaker mentioned should result in a score of -3 or lower
      
      6. YOUR RESPONSE MUST BE A VALID JSON OBJECT WITH EXACTLY THIS FORMAT:
      {
        "score": 5,
        "explanation": "Brief explanation of key factors that determined this score"
      }
      
      The score MUST be a number between -10 and 10, no plus sign, no quotes.
      The explanation MUST be a string.
      Do not include any text before or after the JSON object.
      `;
      
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: "json_object" }  // Request JSON format
      });
      
      // Extract the content from the response
      const content = response.choices[0].message.content?.trim() || "{}";
      
      try {
        // Parse the JSON response
        const parsedResponse = JSON.parse(content);
        
        let score = 0;
        let explanation = "";
        
        // Extract score and explanation from the parsed JSON
        if (typeof parsedResponse.score === 'number') {
          score = parsedResponse.score;
        }
        
        if (typeof parsedResponse.explanation === 'string') {
          explanation = parsedResponse.explanation;
        } else {
          explanation = "No valid explanation provided by LLM.";
        }
        
        // Ensure the score is between -10 and 10
        const finalScore = Math.max(-10, Math.min(10, score));
        const finalExplanation = explanation || "No explanation provided by LLM.";
        
        return res.status(200).json({
          score: finalScore,
          explanation: finalExplanation
        });
      } catch (jsonError) {
        console.error('Error parsing JSON from LLM response:', jsonError);
        return res.status(200).json({
          score: 0,
          explanation: "Failed to parse LLM response."
        });
      }
    }
    
    return res.status(400).json({ error: 'Missing required parameters' });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return res.status(500).json({ error: 'Error calling OpenAI API' });
  }
} 