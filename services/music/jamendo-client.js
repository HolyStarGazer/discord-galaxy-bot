/**
 * Jamendo API Client
 * Fetches royalty-free music from Jamendo's catalog
 * API Documentation: https://developer.jamendo.com/v3.0/docs
 */

const JAMENDO_BASE_URL = 'https://api.jamendo.com/v3.0';

// Supported genres mapped to Jamendo tags
const GENRE_TAGS = {
    pop: 'pop',
    rock: 'rock',
    electronic: 'electronic',
    hiphop: 'hiphop',
    jazz: 'jazz',
    classical: 'classical',
    country: 'country',
    metal: 'metal',
    rnb: 'rnb',
    reggae: 'reggae',
    latin: 'latin',
    ambient: 'ambient',
    folk: 'folk',
    punk: 'punk',
    indie: 'indie',
    lofi: 'lofi+chillhop',
    synthwave: 'synthwave+retrowave',
    eurobeat: 'eurobeat+eurodance',
    drumandbass: 'drumandbass+dnb',
    chillout: 'chillout+relaxing',
    house: 'house',
    techno: 'techno',
    trance: 'trance',
    blues: 'blues',
    funk: 'funk'
};

class JamendoClient {
    constructor(clientId) {
        this.clientId = clientId;

        if (!clientId) {
            throw new Error('Jamendo client ID is required. Set JAMENDO_CLIENT_ID in your .env file.');
        }
    }

    /**
     * Build URL with query parameters
     */
    buildURL(endpoint, params = {}) {
        const url = new URL(`${JAMENDO_BASE_URL}${endpoint}`);
        url.searchParams.set('client_id', this.clientId);
        url.searchParams.set('format', 'json');

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        return url.toString();
    }

    /**
     * Make API request with error handling
     */
    async request(endpoint, params = {}) {
        const url = this.buildURL(endpoint, params);

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Jamendo API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.headers.status === 'error') {
                throw new Error(`Jamendo API error: ${data.headers.error_message}`);
            }

            return data;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Unable to reach Jamendo API');
            }
            throw error;
        }
    }

    /**
     * Get tracks by genre
     * @param {string} genre - Genre key from GENRE_TAGS
     * @param {number} limit - Number of tracks to fetch (1-200)
     * @param {string} order - Sort order (popularity_week, popularity_month, popularity_total, releasedate)
     * @returns {Promise<Array>} - Array of track objects
     */
    async getTracksByGenre(genre, limit = 10, order = 'popularity_week') {
        const tag = GENRE_TAGS[genre] || genre;

        const data = await this.request('/tracks', {
            tags: tag,
            limit: Math.min(limit, 200),
            order: order,
            include: 'musicinfo+licenses',
            audioformat: 'mp32',  // 96kbps MP3 (free tier)
            imagesize: 200
        });

        return this.formatTracks(data.results);
    }

    /**
     * Search tracks by query
     * @param {string} query - Search query
     * @param {number} limit - Number of results
     * @returns {Promise<Array>} - Array of track objects
     */
    async searchTracks(query, limit = 10) {
        const data = await this.request('/tracks', {
            search: query,
            limit: Math.min(limit, 200),
            include: 'musicinfo+licenses',
            audioformat: 'mp32',
            imagesize: 200
        });

        return this.formatTracks(data.results);
    }

    /**
     * Get random tracks (radio-style)
     * @param {string} genre - Optional genre filter
     * @param {number} limit - Number of tracks
     * @returns {Promise<Array>} - Array of track objects
     */
    async getRandomTracks(genre = null, limit = 10) {
        const params = {
            limit: Math.min(limit, 200),
            order: 'random',
            include: 'musicinfo+licenses',
            audioformat: 'mp32',
            imagesize: 200
        };

        if (genre && GENRE_TAGS[genre]) {
            params.tags = GENRE_TAGS[genre];
        }
        
        const data = await this.request('/tracks', params);
        return this.formatTracks(data.results);
    }

    /**
     * Get track by ID
     * @param {string} trackId - Jamendo track ID
     * @returns {Promise<Object>} - Track object or null
     */
    async getTrackById(trackId) {
        const data = await this.request('/tracks', {
            id: trackId,
            include: 'musicinfo+licenses',
            audioformat: 'mp32',
            imagesize: 200
        });

        const tracks = this.formatTracks(data.results);
        return tracks.length > 0 ? tracks[0] : null;
    }

    /**
     * Format raw API tracks to consistent structure
     */
    formatTracks(rawTracks) {
        return rawTracks.map(track => ({
            id: track.id,
            title: track.name || 'Unknown Title',
            artist: track.artist_name || 'Unknown Artist',
            artistId: track.artist_id,
            album: track.album_name || 'Unknown Album',
            albumId: track.album_id,
            duration: parseInt(track.duration) || 0,
            durationFormatted: this.formatDuration(parseInt(track.duration) || 0),
            streamUrl: track.audio,
            downloadUrl: track.audiodownload,
            shareUrl: track.shareurl,
            artworkUrl: track.album_image || track.image,
            license: track.license_ccurl || 'https://creativecommons.org/licenses/',
            releaseDate: track.releasedate,
            source: 'jamendo',
            // Music info if available
            tempo: track.musicinfo?.tempo || null,
            mood: track.musicinfo?.mood || null,
            tags: track.musicinfo?.tags?.genres || []
        }));
    }

    /**
     * Format seconds to MM:SS
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Get available genres
     */
    static getGenres() {
        return Object.keys(GENRE_TAGS);
    }

    /**
     * Get genre choices for Discord slash commands
     */
    static getGenreChoices() {
        const genres = [
            { name: 'Pop', value: 'pop' },
            { name: 'Rock', value: 'rock' },
            { name: 'Electronic', value: 'electronic' },
            { name: 'Hip-Hop', value: 'hiphop' },
            { name: 'Jazz', value: 'jazz' },
            { name: 'Classical', value: 'classical' },
            { name: 'Country', value: 'country' },
            { name: 'Metal', value: 'metal' },
            { name: 'R&B / Soul', value: 'rnb' },
            { name: 'Reggae', value: 'reggae' },
            { name: 'Latin', value: 'latin' },
            { name: 'Ambient', value: 'ambient' },
            { name: 'Folk', value: 'folk' },
            { name: 'Punk', value: 'punk' },
            { name: 'Indie', value: 'indie' },
            { name: 'Lo-Fi', value: 'lofi' },
            { name: 'Synthwave', value: 'synthwave' },
            { name: 'Eurobeat', value: 'eurobeat' },
            { name: 'Drum & Bass', value: 'drumandbass' },
            { name: 'Chillout', value: 'chillout' },
            { name: 'House', value: 'house' },
            { name: 'Techno', value: 'techno' },
            { name: 'Trance', value: 'trance' },
            { name: 'Blues', value: 'blues' },
            { name: 'Funk', value: 'funk' }
        ];

        // Discord limits choices to 25
        return genres.slice(0, 25);
    }
}

module.exports = { JamendoClient, GENRE_TAGS };