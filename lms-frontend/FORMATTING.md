# Code Formatting Setup

This project uses Prettier for automated code formatting to ensure consistent code style across the codebase.

## Tools Used

- **Prettier**: Code formatter for TypeScript, HTML, SCSS, CSS, JSON, and Markdown files

## Manual Formatting

You can format files manually using the following commands:

```bash
# Format all files in the project
npm run format

# Check if files are properly formatted (without changing them)
npm run format:check
```

## Manual Formatting Examples

```bash
# Format all files
npm run format

# Format specific files
npx prettier --write src/app/component.ts
npx prettier --write src/app/component.html
```

## IDE Integration

The project includes VS Code settings for automatic formatting on save. Install the recommended Prettier extension for the best experience.

## Note

Pre-commit hooks have been removed from this project. You can manually format your code before committing using `npm run format`.
