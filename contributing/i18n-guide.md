# I18n Translation Guide

This document explains how to work with the i18n (internationalization) system in this project.

## Overview

This project uses `react-i18next` for internationalization. All user-facing text must be translated to support multiple languages.

## CI/CD Integration

A GitHub Actions workflow automatically checks all PRs to ensure that modified files have been processed for i18n translations. If unprocessed files are detected, the CI will fail.

## Usage in Components

### 1. Import the translation hook

```typescript
import { useTranslation } from "react-i18next";
```

### 2. Use the `t()` function

```typescript
export const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("myComponent.title")}</h1>
      <p>{t("myComponent.description")}</p>
      <button>{t("buttons.save")}</button>
    </div>
  );
};
```

### 3. Add translations to JSON files

**src/locales/en-US.json:**
```json
{
  "myComponent": {
    "title": "My Component",
    "description": "This is a description"
  },
  "buttons": {
    "save": "Save"
  }
}
```

## I18n Tracker Tool

The project includes a tracker tool (`tools/i18n-tracker.cjs`) that monitors which files have been processed for i18n.

### Commands

#### Scan for unprocessed files

```bash
# Scan all files
node tools/i18n-tracker.cjs

# Scan files from last N commits
node tools/i18n-tracker.cjs --git 5

# Limit output to N files
node tools/i18n-tracker.cjs --limit 10
```

#### Mark a file as processed

After adding i18n translations to a file, mark it as processed:

```bash
node tools/i18n-tracker.cjs update <file-path>

# Example:
node tools/i18n-tracker.cjs update src/pages/users/list.tsx
```

## Workflow for Adding I18n to a File

1. **Modify your component** to use `t()` for all user-facing strings

2. **Add translation keys** to locales JSON

3. **Update the tracker**:
   ```bash
   node tools/i18n-tracker.cjs update <file-path>
   ```

4. **Commit all changes** including the updated `.i18n-tracker.lock` file:
   ```bash
   git add src/locales/*.json .i18n-tracker.lock
   git commit -m "Add i18n translations for MyComponent"
   ```

## Translation Key Naming Convention

Follow these conventions for consistency:

- Use nested structure: `resource.section.key`
- Use camelCase for keys
- Group related translations together

### Examples:

```json
{
  "users": {
    "title": "Users",
    "fields": {
      "name": "Name",
      "email": "Email"
    },
    "placeholders": {
      "userName": "Enter user name"
    },
    "validation": {
      "emailRequired": "Email is required"
    }
  }
}
```

## CI Check Failure - How to Fix

If your PR fails the i18n check:

1. **Check the CI output** to see which files need processing

2. **Review each file** and add i18n translations where needed

3. **Update the tracker** for each processed file:
   ```bash
   node tools/i18n-tracker.cjs update <file-path>
   ```

4. **Commit and push** the changes including `.i18n-tracker.lock`

## Advanced: Using Variables in Translations

For dynamic values:

**Translation file:**
```json
{
  "notifications": {
    "createSuccess": "Successfully created {{resource}}"
  }
}
```

**Component:**
```typescript
t("notifications.createSuccess", { resource: "User" })
// Output: "Successfully created User"
```

## Additional Resources

- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Documentation](https://www.i18next.com/)
