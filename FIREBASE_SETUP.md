# Firebase Setup Instructions

This project has been refactored to use Firebase Firestore for real-time data storage and synchronization. Follow these steps to set up Firebase for your project:

## 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter a project name and follow the setup instructions
4. Enable Google Analytics if desired

## 2. Set Up Firebase Authentication

1. In the Firebase Console, go to "Authentication"
2. Click "Get started"
3. Enable the "Google" sign-in provider (this project uses Next Auth with Google)
4. Configure the provider with your Google OAuth credentials

## 3. Create a Firestore Database

1. In the Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Start in production mode or test mode (you can adjust security rules later)
4. Choose a location close to your users

## 4. Set Up Firestore Security Rules

Add these security rules to your Firestore database (adjust as needed):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read and write their own data
    match /users/{userId} {
      allow read;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Conversation rules
    match /conversations/{conversationId} {
      allow read: if request.auth != null && 
                   request.auth.token.email in resource.data.participants;
      allow create: if request.auth != null && 
                      request.auth.token.email in request.resource.data.participants;
      allow update, delete: if request.auth != null && 
                             request.auth.token.email in resource.data.participants;
    }
    
    // Message rules
    match /messages/{messageId} {
      allow read: if request.auth != null && 
                   exists(/databases/$(database)/documents/conversations/$(resource.data.conversationId)) && 
                   request.auth.token.email in get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.participants;
      allow create: if request.auth != null && 
                     exists(/databases/$(database)/documents/conversations/$(request.resource.data.conversationId)) && 
                     request.auth.token.email in get(/databases/$(database)/documents/conversations/$(request.resource.data.conversationId)).data.participants;
      allow update: if request.auth != null && 
                     exists(/databases/$(database)/documents/conversations/$(resource.data.conversationId)) && 
                     request.auth.token.email in get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.participants;
    }
    
    // Survey rules
    match /surveys/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && 
                            request.auth.token.email == userId;
      allow delete: if request.auth != null && 
                    request.auth.token.email == userId;
    }
  }
}
```

## 5. Get Your Firebase Config

1. In the Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" and create a web app if you haven't already
3. Register the app with a name
4. Copy the Firebase configuration object

## 6. Update Environment Variables

Add the following environment variables to your `.env.local` file:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## 7. Migrating Data from MongoDB (Optional)

If you have existing data in MongoDB that you want to migrate to Firebase:

1. Create a migration script using both the MongoDB and Firebase SDKs
2. Fetch all users, conversations, and messages from MongoDB
3. Transform the data to match the Firebase schema
4. Use Firebase batch operations to write the data to Firestore

## 8. Testing and Verification

1. Start your app with `npm run dev`
2. Verify that authentication works properly
3. Test conversation creation and sending messages
4. Verify real-time updates are working correctly
5. Test on multiple devices/browsers simultaneously to confirm real-time functionality

## Benefits of Firebase Integration

- **Real-time updates**: No need for polling as changes are pushed to clients in real-time
- **Offline support**: Firebase can cache data for offline use
- **Scalability**: Firebase automatically scales as your user base grows
- **Reduced server costs**: Firebase handles most of the backend work for you
- **Security rules**: Fine-grained access control at the document level

## Limitations and Considerations

- **Pricing**: Monitor your usage as Firebase charges based on reads, writes, and storage
- **Query limitations**: Firestore has some limitations on complex queries
- **Data modeling**: Firestore works best with a denormalized data model

For more information, refer to the [Firebase documentation](https://firebase.google.com/docs). 