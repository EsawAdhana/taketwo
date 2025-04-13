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
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          image: profile.picture,
          // Explicitly set name to empty string to avoid getting from OAuth
          name: '',
        };
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user }) {
      try {
        // Ensure user and email exist before proceeding
        if (!user || !user.email) {
          console.error('User or user email is missing during sign in.');
          return false; 
        }

        const client = await clientPromise;
        const db = client.db('monkeyhouse');

        // Check if user is banned
        const bannedUser = await db.collection('banned_users').findOne({
          userEmail: user.email,
          permanent: true
        });

        if (bannedUser) {
          console.error('Banned user attempted to sign in:', user.email);
          return false; // This will redirect to error page
        }

        await connectDB();
        
        // Check if user exists
        let dbUser = await User.findOne({ email: user.email });
        
        if (!dbUser) {
          // Create new user if doesn't exist, use "User" as placeholder
          // This will require users to fill in their name in their profile later
          
          dbUser = await User.create({
            name: "User", // Use "User" as a placeholder name
            email: user.email,
            image: user.image,
            // firstName: "User", // Removed redundant firstName
            // region: 'Default Region', // Removed default region
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
        
        if (dbUser && session.user) {
          // Add the user ID to the session
          (session.user as any).id = dbUser._id.toString(); // Cast to any to add id, or adjust session type definition
          // Override session name with our stored value to ensure consistency
          session.user.name = dbUser.name;
        }
        
        return session;
      } catch (error) {
        console.error('Error during session callback:', error); // Added error logging
        return session;
      }
    },
    async jwt({ token, user, account }) {
      return token;
    }
  },
});

export { handler as GET, handler as POST }; 