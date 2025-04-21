# Monkeyhouse

A real-time chat and user matching application built with Next.js and Firebase.

## Firebase Migration

This project has been migrated from MongoDB to Firebase Firestore for real-time data storage and synchronization. All API routes and data operations now use Firebase services.

### Benefits of using Firebase:

- **Real-time updates**: Changes are pushed to clients in real-time
- **Scalable infrastructure**: Firebase automatically scales with user growth
- **Simplified authentication**: Seamless integration with NextAuth
- **Reduced server costs**: Serverless architecture
- **Offline support**: Firebase can cache data for offline use

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up your environment variables in `.env.local`
4. Start the development server:
   ```
   npm run dev
   ```

## Environment Setup

The application requires the following environment variables:

```
# Authentication
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

## Features

- User authentication with Google
- User profiles and surveys
- Real-time messaging
- User recommendations
- Unread message notifications

## Architecture

- **Frontend**: Next.js, React
- **Database**: Firebase Firestore
- **Authentication**: NextAuth.js with Google provider
- **Styling**: Tailwind CSS
- **Icons**: React Icons

## Firebase Security Rules

Refer to `FIREBASE_SETUP.md` for details on the Firebase security rules implemented for this application.

## Recent Code Improvements

The codebase has been cleaned up and refactored to improve maintainability:

1. **Form State Management**
   - Created `useSurveyForm` hook to extract complex form state management from the MultiPageSurvey component
   - Reduced component complexity and improved separation of concerns

2. **Simplified Navigation**
   - Streamlined navigation warning system in SurveyNavigationContext
   - Removed redundant code and simplified click handling

3. **API Utilities**
   - Created centralized API functions in `src/utils/surveyApi.ts`
   - Reduced duplicate code and improved error handling

4. **Code Organization**
   - Improved type safety across components
   - Better separation of UI and data management concerns
   - More consistent styling and component patterns

## Development

```
npm run dev
```

## Technologies

- Next.js
- MongoDB
- NextAuth
- TypeScript
- TailwindCSS 