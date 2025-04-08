import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import clientPromise from '@/lib/mongodb';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        const client = await clientPromise;
        const db = client.db('monkeyhouse');

        // Check if user is banned
        const bannedUser = await db.collection('banned_users').findOne({
          userEmail: user.email,
          permanent: true
        });

        if (bannedUser) {
          throw new Error('Your account has been permanently banned due to multiple reports.');
        }

        await connectDB();
        
        // Check if user exists
        let dbUser = await User.findOne({ email: user.email });
        
        if (!dbUser) {
          // Create new user if doesn't exist
          dbUser = await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
            firstName: user.name?.split(' ')[0] || 'User',
            region: 'Default Region',
          });
        }
        
        return true;
      } catch (error) {
        console.error('Error during sign in:', error);
        return false;
      }
    },
    async session({ session, token }) {
      try {
        if (!session?.user?.email) {
          return session;
        }
        
        await connectDB();
        
        // Find the user in the database
        const dbUser = await User.findOne({ email: session.user.email });
        
        if (dbUser) {
          // Add the user ID to the session
          session.user.id = dbUser._id.toString();
        }
        
        return session;
      } catch (error) {
        return session;
      }
    },
    async jwt({ token, user, account }) {
      return token;
    },
  },
});

export { handler as GET, handler as POST }; 