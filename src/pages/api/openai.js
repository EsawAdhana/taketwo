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
        model: "gpt-4o-mini",
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
          explanation: "One or both users didn't provide additional notes.",
          prune: false 
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
         - CRITICALLY IMPORTANT: Your analysis MUST be symmetric - if the roommates were swapped (Roommate 1's notes given as Roommate 2's and vice versa), the compatibility score should be exactly the same
         - Do not favor the first or second roommate in your analysis; treat both equally
      
      6. EXPLANATION REQUIREMENTS:
         - Do NOT use percentage points or any scoring method other than the -10 to +10 scale
         - Explain the score directly in terms of the -10 to +10 scale
         - Keep explanations concise and directly tied to the compatibility factors
      
      7. YOUR RESPONSE MUST BE A VALID JSON OBJECT WITH EXACTLY THIS FORMAT:
      {
        "score": 5,
        "explanation": "Brief explanation of key factors that determined this score"
      }
      
      The score MUST be a number between -10 and 10, no plus sign, no quotes.
      The explanation MUST be a string.
      Do not include any text before or after the JSON object.
      `;
      
      // To ensure symmetry, we'll run the analysis twice with roommates swapped and average the scores
      const reversePrompt = `
      You are an AI roommate compatibility analyzer.
      You'll be given the "Additional Notes" sections of two potential roommates.
      They have already passed the hard constraints, so these individuals are already vaguely compatible.
      In the Additional Notes section, users provided whatever additional information they felt would be necessary to mention.
      
      Roommate 1: "${notes2}"
      
      Roommate 2: "${notes1}"
      
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
         - CRITICALLY IMPORTANT: Your analysis MUST be symmetric - if the roommates were swapped (Roommate 1's notes given as Roommate 2's and vice versa), the compatibility score should be exactly the same
         - Do not favor the first or second roommate in your analysis; treat both equally
      
      6. EXPLANATION REQUIREMENTS:
         - Do NOT use percentage points or any scoring method other than the -10 to +10 scale
         - Explain the score directly in terms of the -10 to +10 scale
         - Keep explanations concise and directly tied to the compatibility factors
      
      7. YOUR RESPONSE MUST BE A VALID JSON OBJECT WITH EXACTLY THIS FORMAT:
      {
        "score": 5,
        "explanation": "Brief explanation of key factors that determined this score"
      }
      
      The score MUST be a number between -10 and 10, no plus sign, no quotes.
      The explanation MUST be a string.
      Do not include any text before or after the JSON object.
      `;
      
      // Run both analyses
      const [response1, response2] = await Promise.all([
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 150,
          response_format: { type: "json_object" }
        }),
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: reversePrompt }],
          temperature: 0.1,
          max_tokens: 150,
          response_format: { type: "json_object" }
        })
      ]);
      
      // Extract the content from both responses
      const content1 = response1.choices[0].message.content?.trim() || "{}";
      const content2 = response2.choices[0].message.content?.trim() || "{}";
      
      try {
        // Parse both JSON responses
        const parsedResponse1 = JSON.parse(content1);
        const parsedResponse2 = JSON.parse(content2);
        
        // Extract scores and explanation from both responses
        let score1 = typeof parsedResponse1.score === 'number' ? parsedResponse1.score : 0;
        let score2 = typeof parsedResponse2.score === 'number' ? parsedResponse2.score : 0;
        
        // Average the scores to ensure symmetry
        const finalScore = Math.max(-10, Math.min(10, (score1 + score2) / 2));
        
        // Combine explanations or use the first one if they're similar
        let finalExplanation = "";
        if (Math.abs(score1 - score2) <= 1) {
          // Scores are similar, use the more detailed explanation
          finalExplanation = 
            parsedResponse1.explanation?.length >= parsedResponse2.explanation?.length 
              ? parsedResponse1.explanation 
              : parsedResponse2.explanation;
        } else {
          // Scores differ, use combined explanation
          finalExplanation = `Combined assessment: ${parsedResponse1.explanation || "No explanation"} When reversed: ${parsedResponse2.explanation || "No explanation"}`;
        }
        
        finalExplanation = finalExplanation || "No explanation provided by LLM.";
        
        // Determine if the match should be pruned based on compatibility score
        const shouldPrune = finalScore < -5; // Threshold for pruning highly incompatible matches
        
        return res.status(200).json({
          score: finalScore,
          explanation: finalExplanation,
          prune: shouldPrune
        });
      } catch (jsonError) {
        console.error('Error parsing JSON from LLM response:', jsonError);
        return res.status(200).json({
          score: 0,
          explanation: "Failed to parse LLM response.",
          prune: false
        });
      }
    }
    
    return res.status(400).json({ error: 'Missing required parameters' });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return res.status(500).json({ error: 'Error calling OpenAI API' });
  }
} 