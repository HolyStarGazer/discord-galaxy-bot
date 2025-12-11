# Changelog

All notable changes to Galaxy Discord Bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Blackjack game command
- Tic-tac-toe game command
- User profile customization
- Server statistics dashboard
- Achievement system
- Economy system with virtual currency

---

## [0.5.0] - 2025-12-10

### Added
- **Purge Command (`/purge`)**
    - Bulk delete 1-100 messages in a channel
    - Optional user filtering (delete only messages from a specific user)
    - Optional reason field for audit logging
    - Handles Discord's 14-day message deletion limitation
    - Ephemeral responses
    - Runtime permission checks for both user and bot
    - Comprehensive error handling with user-friendly messages

- **Database Backup System**
    - Automatic backups every 24 hours
    - Timestamp-based scheduling (survives bot restarts)
    - Configurable retention (keeps last 3 backups by default)
    - Backup integrity verification
    - Clean, professional logging with file size and status
    - Backup state tracking in `data/last_backup.json`
    - Automatic cleanup of old backups

- **Backup Testing Tools**
    - `scripts/test-backup.js` - Node.js backup verification
    - Comprehensive 6-test validation suite

- **Security Enhancements**
    - Input sanitization for user IDs (validates Discord ID format)
    - Input sanitation for usernames (length validation)
    - Global rate limiting (100 messages/minute per user)
    - Enhanced error logging nwith environment-aware detail levels
    - Graceful shutdown with proper database closure

- **Improved Logging**
    - Styled database initialization messages
    - Consistent color-coded status indicators across all files
    - `[INFO]`, `[OK]`, `[ERROR]`, `[MIGRATE]` status tags
    - Professional formatting matching index.js and deploy-commands.js

- **Enhanced deploy-commands.js**
    - ASCII banner matching index.js style
    - Colored, categorized input
    - Directory structure visualization
    - Comprehensive deployment statistics
    - Environment variable validation
    - Complete deployed commands list with descriptions
    - Deployment mode detection (Guild vs Global)
    - Enhanced error handling with troubleshooting suggestions

### Security
- Added input validation helpers (`sanitizeUserId`, `sanitizeUsername`)
- Implemented global rate limiting to prevent spam/Dos
- Added runtime permission checks for admin commands
- Enhanced error handling to prevent information disclosure
- Implemented proper database connection closure

---

## [0.4.0] - 2025-12-09

### Added
- **Admin XP Management Commands**
    - `/addxp` - Add or remove XP from users
        - Supports positive and negative values
        - Automatic level recalculation
        - Optional reason field ffor audit trail
        - Cannot modify bot accounts
    - `/setlevel` - Set user level directly
        - Range limited to 0-100
        - Automatically calculates required XP
        - Shows XP needed for next level
        - Optional reason field
    - `/setxp` - Set user XP directly
        - Minimal value of 0
        - Automatic level recalculation
        - Shows XP needed for next level
        - Optional reason field

- **Admin Command Features**
    - Administrator permission requried (commands invisible to non-admins)
    - Rich embed responses with before/after stats
    - Console logging for all admin actions
    - Bot account protection across all commands
    - XP bounds checking (cannot go below 0)
    - Colored embeds (green for additions, red for reductions)

### Technical Details
- Level Formula: `level = floor(sqrt(xp / 100)) + 1`
- Inverse Fromula: `xp = (level - 1)^2 * 100`
- Direct database access via prepared statements
- Transaction support for atomic updates

---

## [0.3.0] - 2025-12-08

### Added
- **Wheel Spinner Command** (`/spin`)
    - Vertical slot machine animation with exponential slowdown
    - Supports 2-15 comma-separated options
    - Crypto-random selection using `crypto.randomInt()`
    - Auto-truncation of long names (18 char max)
    - Alternating solid-dotted bars for visual effect

- **Automatic Database Migration System**
    - Built-in migration framework in `database.js`
    - Version tracking using SQLite `PRAGMA user_version`
    - Automatic `last_daily_claim` column migration
    - Auto-creates `/data` directory if missing
    - Auto-creates `bot.db` if missing
    - Eliminated need for separate migration scripts

**Version Management System**
- `scripts/update-version.js` - Automated version updater
- Updates `package.json`, `README.md`, and `index.js` simultaneously
- Supports semantic versioning (major, minor, patch)
- Provides next steps and changelog template
- npm script: `npm run update-version`

### Changed
- **Leaderboard Command** - Complete redesign
    - Three-column inline field layout (Rank | Username | Level/XP/Messages)
    - Code block alignment for clean table appearance
    - Removed emojies for professional look
    - Added "Your Position" field for users outside top list
    - Enhanced footer with user rank display
    - Server icon thumbnail in top-right
    - Invisible Unicode character spacing (U+2800) for field headers
    - Lowercase usernames matching Discord style

- **Userinfo Command** - Major layout overhaul
  - Organized into logical sections (User Info, Server Info, Level & Activity, Roles)
  - Integrated XP/leveling stats with progress bar
  - Visual progress bar: `████████░░` (10 segments)
  - User's role color for embed border
  - Relative timestamps ("1 week ago") with full dates
  - Sorted roles by position (highest first)
  - Shows display name and nickname separately
  - Thousands separators for XP and message counts
  - Level section only appears if user has XP

- **Database Health Check**
    - Now includes database version in output
    - Enhanced error reporting

- **README.md**
    - Added version badges (Version, Node, Discord.js, License)
    - Updated feature list with new commands
    - Added setup instructions for version management

### Fixed
- **Userinfo Progress Bar Crash**
    - Fixed `RangeError: Invalid count value` when XP doesn't match level formula
    - Added bounds checking with `Math.max()` and `Math.min()`
    - Progress bar now always displays 0-100% correctly
    - Handles edge cases (new users, manual XP edits, formula changes)

- **Leaderboard Alignment Issues**
    - Fixed username padding issues with Discord mentions
    - Resolved column misalignment in table display

- **Database Initialization**
    - Fixed missing `last_daily_claim` column for new installations
    - Auto-migration for existing databases

### Removed
- **Separate Migration Scripts**
    - Removed `database-migrations/` directory
    - Migrations now handled internally in `database.js`
    - No more manual migration step required for users

---

## [0.2.3] - 2025-11-29

### Added
- Professional startup ASCII banner with Galaxy cat mascot
- Color-coded console logging system
- Hierarchical command logging system
- Database health check on startup
- Version display in startup banner

### Changed
- Improved console output formatting
- Enhanced error messages with timestamps
- Command loading now  shows directory structure

--- 

## [0.2.0] - 2025-11-28

### Added
- Daily reward system (`/daily` command)
    - 100-150 XP reward every 24 hours
    - Cooldown tracking with remaining time display
    - Level-up support from daily rewards

- Database schema updates
    - `last_daily_claim` column in users table
    - Timestamp tracking for daily claims

### Changed
    - Database helper functions now support daily claim tracking
    - Improved transaction handling for XP updates

---

## [0.1.0] - 2025-11-27

### Added
- Initial bot setup with discord.js v14
- Command handler with slash command support
- SQLite database integration with better-sqlite3
- XP and leveling system
    - Automatic XP gain on messages (15-25 XP, 60s cooldown)
    - Level calculation formula `floor(sqrt(xp / 100)) + 1`
    - Level-up notifications with random celebratory messages

- Commands:
    - `/userinfo [user]` - Display user information
    - `/say <message>` - Echo messages
    - `/roll [dice] [sides]` - Dice roller with custom parameters
    - `/level [user]` - Check XP, level, and progress
    - `/leaderboard [limit]` - View top users (3-25)

- Database tables:
    - `users` - User XP and statistics
    - `game_sessions` - Future game state tracking
    - `leaderboard` - View for ranked uesrs

- Features:
    - Message-based XP gain with cooldown
    - Progress tracking with visual progress bars
    - Server rank calculation
    - Leaderboard with pagination

---

## Version Numbering

This project uses [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality (backwards-compatible)
- **PATCH** version for backwards-compatible bug fixes
---

## Links

- [GitHub Repository](https://github.com/HolyStarGazer/discord-galaxy-bot)
- [Report Issues](https://github.com/HolyStarGazer/discord-galaxy-bot/issues)
- [Discord.js Documentation](https://discord.js.org/)

---

**Note:** Dates in this changelog reflect feature completion dates and may differ from Git commit dates.