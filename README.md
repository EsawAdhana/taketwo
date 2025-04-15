# MonkeyHouse

A roommate matching platform for interns and temporary workers

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