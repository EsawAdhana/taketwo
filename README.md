# monkeyhouse

A matching app for interns looking for housing. Fill out a short survey about where you want to live, your dates, budget, and lifestyle, and it surfaces the most compatible people. You can message matches directly in the app.

Compatibility considers overlapping cities, budget overlap, at least 75% timeline overlap, and similar lifestyle preferences. Matching the same internship company nudges you up the rankings.

## Stack

Next.js + TypeScript, Firebase for auth and Firestore, Tailwind for styles. `bad-words` for content filtering, `date-fns` for date math. Security rules are in `firestore.rules`.

## Privacy

Email is only shared with people you actually message. Messages are encrypted, and users can report or block anyone.
