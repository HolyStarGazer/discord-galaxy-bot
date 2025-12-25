const { log, logWithTimestamp } = require('./formatters');

let client = null;
let db = null;
let lastHealthCheck = null;

function initHealthMonitor(clientInstance, dbInstance) {
    client = clientInstance;
    db = dbInstance;

    // Run health check every 30 minutes
    setInterval(runHealthCheck, 30 * 60 * 1000);

    // Run initial health check
    runHealthCheck();

    log('OK', 'Health monitor initialized', 4);
}

function runHealthCheck() {
    const health = {
        timestamp: new Date().toISOString(),
        discord: false,
        database: false,
        memory: null,
        uptime: null
    };

    // Check Discord connection
    health.discord = client && client.isReady();

    // Check database
    try {
        const result = db.prepare('SELECT 1').get();
        health.database = result !== undefined;
    } catch (error) {
        health.database = false;
    }

    // Memory usage
    const mem = process.memoryUsage();
    health.memory = {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // in MB
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024), // in MB
        rss: Math.round(mem.rss / 1024 / 1024) // in MB
    };

    // Uptime
    health.uptime = process.uptime(); // in seconds

    lastHealthCheck = health;

    // Log warnings
    if (!health.discord) {
        logWithTimestamp('WARN', 'Discord connection is not healthy');
    }

    if (!health.database) {
        logWithTimestamp('WARN', 'Database connection is not healthy');
    }

    if (health.memory.heapUsed > 500) {
        logWithTimestamp('WARN', `High memory usage: ${health.memory.heapUsed} MB`);
    }

    return health;
}

function getLastHealthCheck() {
    return lastHealthCheck;
}

module.exports = {
    initHealthMonitor,
    runHealthCheck,
    getLastHealthCheck
}