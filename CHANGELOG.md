# Changelog

All notable changes to Galaxy Discord Bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Blackjack game command
- User profile customization
- Server statistics dashboard
- Achievement system

---

## [0.3.0] - 2025-12-04

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

## Version History Summary

- **0.3.0** (2025-12-08) - Major UI overhaul, database migrations, version management, admin tools
- **0.2.2** (2025-11-29) - Professional logging and startup screen
- **0.2.0** (2025-11-28) - Daily reward system
- **0.1.0** (2025-11-27) - Initial release with leveling system

---

## Links

- [GitHub Repository](https://github.com/HolyStarGazer/discord-galaxy-bot)
- [Report Issues](https://github.com/HolyStarGazer/discord-galaxy-bot/issues)
- [Discord.js Documentation](https://discord.js.org/)

--- 

## Migration Notes

### Upgrading to 0.3.0

No manual migration required! The database will automatically update on bot startup.

**What happens automatically:**
1. Creates `/data` directory if missing
2. Creates `bot.db` if missing
3. Adds `last_daily_claim` column if upgrading from 0.1.0
4. Updates database version to track migrations

**To update:**
```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Start bot (migrations run automatically)
npm start
```

### Upgrading from Pre-0.2.0

If you have a database from before version 0.2.0:
- The automatic mgiration will add the `last_daily_column`
- Existing user data is preserved
- No data loss occurs

---

## Development Notes

### Adding new Migrations

To add a new database migration, edit `config/database.js`

```javascript
const migrations = [
    {
        version: 1,
        description: 'Add last_daily_column',
        run: () => { /* ... */ }
    },
    {
        version: 2, // New migration
        description: 'Your new migration',
        run: () => {
            // Migration code here
        }
    }
];
```

Then update the CREATE TABLE statement to include new columns for fresh installs

### Updating version

```bash
# Bug fix (0.3.0 -> 0.3.1)
npm run update-version patch

# New feature (0.3.0 -> 0.4.0)
npm run update-version minor

# Breaking change (0.3.0 -> 1.0.0)
npm run update-version major
```

## Contributors

- **HolyStar** - Initial work and ongoing development

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Acknowledgements

- Discord.js community for excellent documentation
- Better-sqlite3 for fast database operations
- All users who provided feedback and testing

---

**Note:** Dates in this changelog reflect feature completion dates and may differ from Git commit dates.