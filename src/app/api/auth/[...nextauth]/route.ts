import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { createOrUpdateUser } from '@/lib/firebaseService';

const handler = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) {
        return false;
      }
      
      try {
        // Store user in Firebase
        await createOrUpdateUser({
          email: user.email,
          name: user.name || '',
          image: user.image || '',
        });
        return true;
      } catch (error) {
        console.error('Error creating/updating user in Firebase:', error);
        return false;
      }
    },
    async session({ session, token }) {
      // Add user ID from token to the session
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      // Add user ID to token when first created
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/error',
  },
});

export { handler as GET, handler as POST }; 