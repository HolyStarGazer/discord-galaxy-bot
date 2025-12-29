/**
 * Music Queue Manager
 * Handles queue operations for each guild
 */

class QueueManager {
    constructor() {
        // Map of guildId -> GuildQueue
        this.queues = new Map();
    }

    /**
     * Get or create a queue for a guild
     * @param {string} guildId
     * @return {GuildQueue}
     */
    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, new GuildQueue(guildId));
        }
        return this.queues.get(guildId);
    }

    /**
     * Check if a guild has an active queue
     * @param {string} guildId
     * @return {boolean}
     */
    hasQueue(guildId) {
        const queue = this.queues.get(guildId);
        return queue && queue.tracks.length > 0;
    }

    /**
     * Delete a guild's queue
     * @param {string} guildId
     */
    deleteQueue(guildId) {
        this.queues.delete(guildId);
    }

    /**
     * Get all active queues (for stats/debugging)
     * @returns {Map}
     */
    getAllQueues() {
        return this.queues;
    }
}

class GuildQueue {
    constructor(guildId) {
        this.guildId = guildId;
        this.tracks = [];
        this.currentIndex = 0;
        this.loop = false;       // Loop current track
        this.loopQueue = false;  // Loop entire queue
        this.volume = 100;       // Volume percentage (0-100)
        this.createdAt = Date.now();
    }

    /**
     * Add a track to teh end of the queue
     * @param {Object} track
     * @returns {number} Position in queue
     */
    add(track) {
        this.tracks.push(track);
        return this.tracks.length;
    }

    /**
     * Add multiple tracks to the queue
     * @param {Array} tracks
     * @returns {number} Number of tracks added
     */
    addMany(tracks) {
        this.tracks.push(...tracks);
        return tracks.length;
    }

    /**
     * Insert a track at a specific position
     * @param {Object} track
     * @param {number} position - 1-indexed position
     * @return {boolean} Success
     */
    insert(track, position) {
        const index = Math.max(0, Math.min(position - 1, this.tracks.length));
        this.tracks.splice(index, 0, track);
        return true;
    }

    /**
     * Remove a track by position
     * @param {number} position - 1-indexed position
     * @return {Object|null} Removed track or null
     */
    remove(position) {
        const index = position - 1;
        if (index < 0 || index >= this.tracks.length) {
            return null;
        }

        const [removed] = this.tracks.splice(index, 1);

        // Adjust current index if needed
        if (index < this.currentIndex) {
            this.currentIndex = Math.max(0, this.currentIndex - 1);
        }

        return removed;
    }

    /**
     * Move a track from one position to another
     * @param {number} from - 1-indexed source position
     * @param {number} to - 1-indexed destination position
     * @return {boolean} Success
     */
    move(from, to) {
        const fromIndex = from - 1;
        const toIndex = to - 1;

        if (fromIndex < 0 || fromIndex >= this.tracks.length) {
            return false;
        }

        // Clamp destination
        const destIndex = Math.max(0, Math.min(toIndex, this.tracks.length - 1));

        // Remove and insert
        const [track] = this.tracks.splice(fromIndex, 1);
        this.tracks.splice(destIndex, 0, track);

        return true;
    }

    /**
     * Get the current track
     * @returns {Object|null}
     */
    current() {
        return this.tracks[this.currentIndex] || null;
    }

    /**
     * Get the next track and advance the index
     * @returns {Object|null}
     */
    next() {
        // If looping current track, return it again
        if (this.loop) {
            return this.current();
        }

        // Advance index
        this.currentIndex++;
        if (this.currentIndex >= this.tracks.length) {
            if (this.loopQueue) {
                // Loop back to start
                this.currentIndex = 0;
            } else {
                // No more tracks
                return null;
            }
        }

        return this.current();
    }

    /**
     * Skip a number of tracks
     * @param {number} count - Number of tracks to skip
     * @returns {Object|null} - The new current track
     */
    skip(count = 1) {
        this.currentIndex += count;

        if (this.currentIndex >= this.tracks.length) {
            if (this.loopQueue) {
                this.currentIndex = this.currentIndex % this.tracks.length;
            } else {
                this.currentIndex = this.tracks.length;
                return null;
            }
        }

        return this.current();
    }

    /**
     * Go back to previous track
     * @returns {Object|null}
     */
    previous() {
        this.currentIndex = Math.max(0, this.currentIndex - 1);
        return this.current();
    }

    /**
     * Jump to a specific position
     * @param {number} position - 1-indexed position
     * @returns {Object|null}
     */
    jumpTo(position) {
        const index = position - 1;
        if (index < 0 || index >= this.tracks.length) {
            return null;
        }
        this.currentIndex = index;
        return this.current();
    }

    /**
     * Clear all tracks from the queue
     */
    clear() {
        this.tracks = [];
        this.currentIndex = 0;
    }

    /**
     * Shuffle the queue (excluding current track)
     */
    shuffle() {
        if (this.tracks.length <= 1) return;

        // Get current track
        const currentTrack = this.current();

        // Get remaining tracks (after current)
        const remaining = this.tracks.slice(this.currentIndex + 1);

        // Fisher-Yates shuffle
        for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }

        // Rebuild queue: played tracks + current + shuffled remaining
        this.tracks = [
            ...this.tracks.slice(0, this.currentIndex + 1),
            ...remaining
        ];
    }

    /**
     * Get upcoming tracks (after current)
     * @param {number} limit - Max tracks to return
     * @returns {Array}
     */
    getUpcoming(limit = 10) {
        return this.tracks.slice(this.currentIndex + 1, this.currentIndex + 1 + limit);
    }

    /**
     * Get queue info for display
     * @param {number} page - Page number (1-indexed)
     * @param {number} perPage - Tracks per page
     * @returns {Object}
     */
    getPage(page = 1, perPage = 10) {
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const tracks = this.tracks.slice(startIndex, endIndex);
        const totalPages = Math.ceil(this.tracks.length / perPage);

        return {
            tracks: tracks.map((track, i) => ({
                ...track,
                position: startIndex + i + 1,
                isCurrent: startIndex + i === this.currentIndex
            })),
            page,
            totalPages,
            totalTracks: this.tracks.length,
            currentIndex: this.currentIndex + 1
        };
    }

    /**
     * Get total duration of remaining tracks
     * @returns {number} Duration in seconds
     */
    getRemainingDuration() {
        return this.tracks
            .slice(this.currentIndex)
            .reduce((total, track) => total + (track.duration || 0), 0);
    }

    /**
     * Get queue size
     * @returns {number}
     */
    get size() {
        return this.tracks.length;
    }

    /**
     * Check if queue is empty
     * @returns {boolean}
     */
    get isEmpty() {
        return this.tracks.length === 0;
    }

    /**
     * Get number of remaining tracks
     * @returns {number}
     */
    get remaining() {
        return Math.max(0, this.tracks.length - this.currentIndex - 1);
    }
}

// Singleton instance
const queueManager = new QueueManager();

module.exports = { queueManager, QueueManager, GuildQueue };