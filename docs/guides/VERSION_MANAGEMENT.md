# Version Management Guide

## Overview

This bot uses **package.json** as the single source of truth for versioning, with automatic updates to README and code.

---

## Setup

### 1. Add Version to index.js

At the top of `index.js`, add:

```javascript
const { version } = require('./package.json');
```

Then in your startup banner, use it:

```javascript
console.log(`${colors.cyan}║${colors.reset}     ${colors.dim}Version ${version}${colors.reset}                                         ${colors.cyan}║${colors.reset}`);
```

### 2. Create scripts Directory

```bash
mkdir scripts
```

### 3. Copy Update Script

Copy `update-version.js` to `scripts/update-version.js`

### 4. Make It Executable (Mac/Linux)

```bash
chmod +x scripts/update-version.js
```

---

## Usage

### Update Version Automatically

```bash
# Patch version (0.3.0 -> 0.3.1) - Bug fixes
npm run update-version patch

# Minor version (0.3.0 -> 0.4.0) - New features
npm run update-version minor

# Major version (0.3.0 -> 1.0.0) - Breaking changes
npm run update-version major

# Set specific version
npm run update-version 1.2.3
```

### What Gets Updated

The script automatically updates:

✅ **package.json** - Main version number  
✅ **README.md** - Version badge and text  
✅ **index.js** - Version constant (if exists)  

---

## Semantic Versioning

Follow [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH):

### PATCH (0.3.0 → 0.3.1)
**Use when:** Fixing bugs, no new features

**Examples:**
- Fixed progress bar crash in userinfo
- Corrected XP calculation bug
- Fixed typo in command description

### MINOR (0.3.0 → 0.4.0)
**Use when:** Adding new features, backwards compatible

**Examples:**
- Added `/spin` command
- Added leaderboard improvements
- New database query command

### MAJOR (0.3.0 → 1.0.0)
**Use when:** Breaking changes, major overhauls

**Examples:**
- Changed database schema (requires migration)
- Removed deprecated commands
- Rewrote core systems

---

## Workflow Example

### Scenario: You fixed a bug and added a feature

```bash
# 1. Update version (minor because of new feature)
npm run update-version minor
# Output: 0.3.0 → 0.4.0

# 2. Update CHANGELOG.md manually
nano CHANGELOG.md

# 3. Commit changes
git add .
git commit -m "Release v0.4.0"

# 4. Create tag
git tag v0.4.0

# 5. Push to GitHub
git push && git push --tags
```

---

## CHANGELOG.md Template

Create a `CHANGELOG.md` file:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Things you plan to add

## [0.4.0] - 2024-12-04

### Added
- `/spin` command for wheel spinner
- Three-column leaderboard layout
- XP progress bar in userinfo

### Changed
- Improved userinfo layout with sections
- Updated leaderboard to show messages column

### Fixed
- Fixed negative progress bar crash in userinfo
- Corrected alignment issues in leaderboard

## [0.3.0] - 2024-11-27

### Added
- Initial release
- Basic leveling system
- Daily rewards
- Leaderboard

[Unreleased]: https://github.com/yourusername/discord-galaxy-bot/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/yourusername/discord-galaxy-bot/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yourusername/discord-galaxy-bot/releases/tag/v0.3.0
```

---

## Version in README.md

Your README now has badges at the top:

```markdown
# Galaxy Discord Bot

![Version](https://img.shields.io/badge/version-0.3.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2)
![License](https://img.shields.io/badge/license-MIT-green)
```

The script will automatically update the version badge!

---

## Manual Version Update

If you prefer to update manually:

### 1. Update package.json

```json
{
  "name": "discord-galaxy-bot",
  "version": "0.4.0",  // ← Change this
  ...
}
```

### 2. Update README.md

```markdown
![Version](https://img.shields.io/badge/version-0.4.0-blue)
```

### 3. index.js (automatic)

Since you're using `require('./package.json')`, it automatically reads the new version!

---

## Git Tags

Always tag releases:

```bash
# Create annotated tag
git tag -a v0.4.0 -m "Release version 0.4.0"

# Push tag to GitHub
git push origin v0.4.0

# Or push all tags
git push --tags
```

### Why Tag?

- Easy to see version history: `git tag`
- Easy to checkout specific version: `git checkout v0.4.0`
- GitHub creates releases automatically
- Users can download specific versions

---

## GitHub Releases

After pushing a tag, create a release on GitHub:

1. Go to your repo → **Releases**
2. Click **"Draft a new release"**
3. Select the tag (v0.4.0)
4. Title: "Version 0.4.0"
5. Description: Copy from CHANGELOG.md
6. Click **"Publish release"**

---

## Quick Reference

```bash
# Check current version
npm version

# Update version (patch)
npm run update-version patch

# Update version (minor)
npm run update-version minor

# Update version (major)
npm run update-version major

# Commit and tag
git add .
git commit -m "Release v0.4.0"
git tag v0.4.0
git push && git push --tags
```

---

## Files Structure

```
discord-galaxy-bot/
├── package.json          # ← VERSION SOURCE OF TRUTH
├── README.md             # ← Auto-updated by script
├── index.js              # ← Reads from package.json
├── CHANGELOG.md          # ← Manual updates
└── scripts/
    └── update-version.js # ← Update script
```

---

## npm Scripts Available

```json
"scripts": {
  "start": "node index.js",
  "deploy": "node deploy-commands.js",
  "dev": "nodemon index.js",
  "update-version": "node scripts/update-version.js"
}
```

Usage:
```bash
npm start              # Run bot
npm run deploy         # Deploy commands
npm run dev            # Run with auto-restart
npm run update-version # Update version (needs argument)
```

---

## Best Practices

✅ **Always** update version before releasing  
✅ **Always** update CHANGELOG.md  
✅ **Always** create a git tag  
✅ **Never** manually edit version in multiple places  
✅ **Use** semantic versioning  
✅ **Write** descriptive commit messages  

❌ **Don't** skip version updates  
❌ **Don't** push without tagging  
❌ **Don't** use inconsistent version numbers  

---

## Example: Full Release Process

```bash
# 1. Make your changes
# ... coding ...

# 2. Update version
npm run update-version minor
# 0.3.0 → 0.4.0

# 3. Update CHANGELOG.md
nano CHANGELOG.md
# Add your changes under [0.4.0]

# 4. Commit everything
git add .
git commit -m "Release v0.4.0

Added:
- Spin command
- Improved leaderboard

Fixed:
- Userinfo progress bar bug"

# 5. Tag the release
git tag -a v0.4.0 -m "Version 0.4.0"

# 6. Push to GitHub
git push origin main
git push origin v0.4.0

# 7. Create GitHub release (optional, via web UI)

# 8. Deploy to production
ssh ubuntu@your-server
cd discord-galaxy-bot
git pull
npm install
pm2 restart galaxy-bot
```

Done! 🎉