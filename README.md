# monkeyhouse

Find your perfect intern roommate.

## Overview

MonkeyHouse matches interns looking for housing in the same area. Fill out a short survey about your preferences and the app shows you people compatible on budget, timeline, and lifestyle.

How it works:

1. Sign in with Google.
2. Complete the survey (~2 minutes).
3. Browse matches sorted by compatibility.
4. Message people directly in the app.

Matching considers overlapping cities/regions, budget compatibility, ≥75% timeline overlap, similar lifestyle preferences, and a small boost for matching internship company.

## Stack

- Next.js + TypeScript
- Firebase (Auth + Firestore)
- Tailwind CSS
- `bad-words` (content filter), `date-fns`

## Getting started

```bash
npm install
npm run dev
```

Set up a Firebase project and configure auth + Firestore. See `firestore.rules` for security rules.

## Privacy

- Email is only shared with people you message
- Messages are encrypted
- Users can report or block anyone

## Status

Active.
