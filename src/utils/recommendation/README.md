# Recommendation Engine

This directory contains a modular refactoring of the original `recommendationEngine.ts` file, splitting it into smaller, more maintainable components.

## Directory Structure

- `analysis.ts` - Functions for analyzing additional notes using NLP
- `constants.ts` - Constants used throughout the recommendation system
- `constraints.ts` - Functions for checking hard constraints between users
- `debug.ts` - Debug utilities for investigating compatibility issues
- `enhanced-scoring.ts` - Enhanced scoring functions using NLP for additional notes
- `helpers.ts` - Utility functions for data conversion and Firebase operations
- `index.ts` - Main export file that re-exports all functionality
- `recommendations.ts` - Main recommendation functions for matching users
- `scoring.ts` - Core compatibility scoring functions
- `types.ts` - TypeScript interfaces and types

## Usage

You can continue to import from the original location:

```typescript
import { calculateCompatibilityScore, getRecommendedMatches } from '@/utils/recommendationEngine';
```

The original file now re-exports everything from this directory structure.

## Issues and Troubleshooting

If you encounter TypeScript errors related to module resolution, you may need to:

1. Restart your TypeScript server or IDE
2. Make sure the paths in tsconfig.json are correctly configured
3. Check that all import paths are correct in the refactored files

## Future Improvements

- Add unit tests for each module
- Consider further splitting large files like `scoring.ts` and `recommendations.ts`
- Improve error handling and logging throughout the modules 