import { NextApiRequest, NextApiResponse } from 'next';
import { compareUsers } from '@/utils/recommendationEngine';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email1, email2 } = req.query;
    
    if (!email1 || !email2 || typeof email1 !== 'string' || typeof email2 !== 'string') {
      return res.status(400).json({ error: 'Two valid email addresses are required' });
    }

    // Use compareUsers from recommendationEngine to get detailed comparison
    const result = await compareUsers(email1, email2, true);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error comparing users:', error);
    return res.status(500).json({ 
      error: 'Error comparing users', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 