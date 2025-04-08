import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';

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
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async session({ session, token }) {
      try {
        if (!session?.user?.email) {
          console.error('Session callback: No user email in session');
          return session;
        }
        
        await connectDB();
        
        // Find the user in the database
        const dbUser = await User.findOne({ email: session.user.email });
        
        if (dbUser) {
          // Add the user ID to the session
          session.user.id = dbUser._id.toString();
          console.log(`Session callback: Set user.id to ${session.user.id} for ${session.user.email}`);
        } else {
          console.error(`Session callback: No user found in DB for email ${session.user.email}`);
        }
        
        return session;
      } catch (error) {
        console.error('Error in session callback:', error);
        return session;
      }
    },
    async jwt({ token, user, account }) {
      return token;
    },
  },
});

export { handler as GET, handler as POST }; 