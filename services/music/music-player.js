/**
 * Music Player Service
 * Handles voice connections and audio playback using @discordjs/voice
 */

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
    NoSubscriberBehavior
} = require('@discordjs/voice');

const { Readable } = require('stream');
const { queueManager } = require('./queue-manager');
const { log, logWithTimestamp } = require('../../utils/formatters');

// Map of guildId -> { player, connection, textChannel }
const players = new Map();

// Inactivity timeout (5 minutes)
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

/**
 * Get or create a player for a guild
 * @param {string} guildId
 * @returns {Object|null}
 */
function getPlayer(guildId) {
    return players.get(guildId) || null;
}

/**
 * Join a voice channel and set up the audio player
 * @param {VoiceChannel} voiceChannel - The voice channel to join
 * @param {TextChannel} textChannel - The text channel for notifications
 * @returns {Object} Player context
 */
async function joinChannel(voiceChannel, textChannel) {
    const guildId = voiceChannel.guild.id;

    // Check for existing connection
    let playerContext = players.get(guildId);

    if (playerContext) {
        // Already connected, just update text channel
        playerContext.textChannel = textChannel;
        return playerContext;
    }

    // Create voice connection
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true  // Bot deafens itself (good practice)
    });

    // Create audio player
    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Play  // Keep playing even if no one is listening
        }
    });

    // Subscribe connection to player
    connection.subscribe(player);

    // Create player context
    playerContext = {
        player,
        connection,
        textChannel,
        voiceChannel,
        guildId,
        inactivityTimer: null,
        nowPlaying: null
    };

    players.set(guildId, playerContext);

    // Set up event handlers
    setupPlayerEvents(playerContext);
    setupConnectionEvents(playerContext);

    // Wait for connection to be ready
    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        logWithTimestamp('OK', `Joined voice channel: ${voiceChannel.name} (${guildId})`);
    } catch (error) {
        connection.destroy();
        players.delete(guildId);
        throw new Error('Failed to join voice channel within 30 seconds.');
    }

    return playerContext;
}

/**
 * Set up audio player event handlers
 */
function setupPlayerEvents(ctx) {
    const { player, guildId } = ctx;

    player.on(AudioPlayerStatus.Idle, async () => {
        // Track finished, play next
        const queue = queueManager.getQueue(guildId);
        const nextTrack = queue.next();

        if (nextTrack) {
            await playTrack(guildId, nextTrack);
        } else {
            // Queue finished
            ctx.nowPlaying = null;
            startInactivityTimer(ctx);

            if (ctx.textChannel) {
                ctx.textChannel.send({
                    content: 'Queue finished. I\'ll leave in 5 minutes if nothing is played.'
                }).catch(() => {});
            }
        }
    });

    player.on(AudioPlayerStatus.Playing, () => {
        // Clear inactivity timer when playing
        clearInactivityTimer(ctx);
    });

    player.on('error', (error) => {
        logWithTimestamp('ERROR', `Audio player error: ${error.message}`);

        // Try to skip to next track
        const queue = queueManager.getQueue(guildId);
        const nextTrack = queue.next();

        if (nextTrack) {
            playTrack(guildId, nextTrack).catch(() => {});
        }
    });
}

/**
 * Set up voice connection event handlers
 */
function setupConnectionEvents(ctx) {
    const { connection, guildId } = ctx;

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            // Try to reconnect
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
            ]);
            // Reconnecting...
        } catch (error) {
            // Disconnected and can't reconnect, clean up
            cleanup(guildId);
        }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
        cleanup(guildId);
    });
}

/**
 * Fetch audio stream from URL
 * @param {string} url - The audio URL to fetch
 * @returns {Promise<Readable>} Node.js readable stream
 */
async function fetchAudioStream(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }

    // Convert Web ReadableStream to Node.js Readable stream
    return Readable.fromWeb(response.body);
}

/**
 * Play a track
 * @param {string} guildId
 * @param {Object} track
 */
async function playTrack(guildId, track) {
    const ctx = players.get(guildId);
    if (!ctx) {
        throw new Error('No active player for this guild');
    }

    try {
        // Fetch the audio stream from the URL
        const audioStream = await fetchAudioStream(track.streamUrl);

        // Create audio resource from the stream
        const resource = createAudioResource(audioStream, {
            inlineVolume: true
        });

        // Set volume
        const queue = queueManager.getQueue(guildId);
        if (resource.volume) {
            resource.volume.setVolume(queue.volume / 100);
        }

        // Play the resource
        ctx.player.play(resource);
        ctx.nowPlaying = track;

        logWithTimestamp('MUSIC', `Playing: ${track.title} by ${track.artist}`);

        // Send now playing message
        if (ctx.textChannel) {
            const embed = createNowPlayingEmbed(track, queue);
            ctx.textChannel.send({ embeds: [embed] }).catch(() => {});
        }

        return track;
    } catch (error) {
        logWithTimestamp('ERROR', `Failed to play track: ${error.message}`);
        throw error;
    }
}

/**
 * Create now playing embed
 */
function createNowPlayingEmbed(track, queue) {
    const { EmbedBuilder } = require('discord.js');

    const embed = new EmbedBuilder()
        .setColor(0x00D4AA)
        .setTitle('Now Playing')
        .setDescription(`**[${track.title}](${track.license})**`)
        .addFields(
            { name: 'Artist', value: track.artist, inline: true },
            { name: 'Duration', value: track.durationFormatted || '--:--', inline: true },
            { name: 'Source', value: 'Jamendo', inline: true }
        )
        .setFooter({ text: `${queue.remaining} tracks remaining in queue` });

    if (track.artworkUrl) {
        embed.setThumbnail(track.artworkUrl);
    }

    return embed;
}

/**
 * Start playing the queue
 * @param {string} guildId
 */
async function startPlaying(guildId) {
    const queue = queueManager.getQueue(guildId);
    const track = queue.current();

    if (!track) {
        throw new Error('Queue is empty');
    }

    await playTrack(guildId, track);
}

/**
 * Pause playback
 * @param {string} guildId
 * @returns {boolean}
 */
function pause(guildId) {
    const ctx = players.get(guildId);
    if (!ctx) return false;

    ctx.player.pause();
    return true;
}

/**
 * Resume playback
 * @param {string} guildId
 * @returns {boolean}
 */
function resume(guildId) {
    const ctx = players.get(guildId);
    if (!ctx) return false;

    ctx.player.unpause();
    return true;
}

/**
 * Skip the current track
 * @param {string} guildId
 * @returns {Object|null} Next track or null
 */
async function skip(guildId) {
    const ctx = players.get(guildId);
    if (!ctx) return null;

    const queue = queueManager.getQueue(guildId);
    const nextTrack = queue.next();

    if (nextTrack) {
        await playTrack(guildId, nextTrack);
        return nextTrack;
    } else {
        ctx.player.stop();
        return null;
    }
}

/**
 * Stop playback and clear queue
 * @param {string} guildId
 */
function stop(guildId) {
    const ctx = players.get(guildId);
    if (!ctx) return;

    queueManager.getQueue(guildId).clear();
    ctx.player.stop();
    ctx.nowPlaying = null;
}

/**
 * Leave the voice channel
 * @param {string} guildId
 */
function leave(guildId) {
    const ctx = players.get(guildId);
    if (!ctx) return;

    stop(guildId);
    ctx.connection.destroy();
    cleanup(guildId);
}

/**
 * Set volume
 * @param {string} guildId
 * @param {number} volume - 0-100
 */
function setVolume(guildId, volume) {
    const ctx = players.get(guildId);
    const queue = queueManager.getQueue(guildId);

    queue.volume = Math.max(0, Math.min(100, volume));

    // Apply to current resource if playing
    if (ctx && ctx.player.state.status === AudioPlayerStatus.Playing) {
        const resource = ctx.player.state.resource;
        if (resource && resource.volume) {
            resource.volume.setVolume(queue.volume / 100);
        }
    }
}

/**
 * Get current player status
 * @param {string} guildId
 * @returns {Object|null}
 */
function getStatus(guildId) {
    const ctx = players.get(guildId);
    if (!ctx) return null;

    const queue = queueManager.getQueue(guildId);

    return {
        playing: ctx.player.state.status === AudioPlayerStatus.Playing,
        paused: ctx.player.state.status === AudioPlayerStatus.Paused,
        nowPlaying: ctx.nowPlaying,
        queueSize: queue.size,
        remaining: queue.remaining,
        volume: queue.volume,
        loop: queue.loop,
        loopQueue: queue.loopQueue
    };
}

/**
 * Start inactivity timer
 */
function startInactivityTimer(ctx) {
    clearInactivityTimer(ctx);

    ctx.inactivityTimer = setTimeout(() => {
        logWithTimestamp('INFO', `Leaving ${ctx.guildId} due to inactivity`);
        leave(ctx.guildId);
    }, INACTIVITY_TIMEOUT);
}

/**
 * Clear inactivity timer
 */
function clearInactivityTimer(ctx) {
    if (ctx.inactivityTimer) {
        clearTimeout(ctx.inactivityTimer);
        ctx.inactivityTimer = null;
    }
}

/**
 * Clean up player resources
 */
function cleanup(guildId) {
    const ctx = players.get(guildId);
    if (ctx) {
        clearInactivityTimer(ctx);
    }

    players.delete(guildId);
    queueManager.deleteQueue(guildId);

    logWithTimestamp('INFO', `Cleaned up music player for guild ${guildId}`);
}

/**
 * Check if bot is in a voice channel
 * @param {string} guildId
 * @returns {boolean}
 */
function isConnected(guildId) {
    return players.has(guildId);
}

/**
 * Get all active players (for stats)
 * @returns {number}
 */
function getActivePlayerCount() {
    return players.size;
}

module.exports = {
    joinChannel,
    playTrack,
    startPlaying,
    pause,
    resume,
    skip,
    stop,
    leave,
    setVolume,
    getPlayer,
    getStatus,
    isConnected,
    getActivePlayerCount,
    cleanup
};
