import redisClient from '../config/redis.js';

/**
 * Redis-based rate limiter middleware factory
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Max requests per window
 * @param {string} options.keyPrefix - Redis key prefix
 * @param {string} options.message - Error message when limit exceeded
 */
export const rateLimiter = ({ windowMs = 60000, max = 10, keyPrefix = 'rl', message = 'Too many requests, please try again later.' } = {}) => {
    return async (req, res, next) => {
        try {
            const identifier = req.ip || req.connection.remoteAddress;
            const key = `${keyPrefix}:${identifier}`;
            const windowSeconds = Math.ceil(windowMs / 1000);

            const current = await redisClient.incr(key);

            if (current === 1) {
                await redisClient.expire(key, windowSeconds);
            }

            if (current > max) {
                const ttl = await redisClient.ttl(key);
                return res.status(429).json({
                    message,
                    retryAfter: ttl
                });
            }

            // Set rate limit headers
            res.set({
                'X-RateLimit-Limit': max,
                'X-RateLimit-Remaining': Math.max(0, max - current),
                'X-RateLimit-Reset': Math.ceil(Date.now() / 1000) + (await redisClient.ttl(key))
            });

            next();
        } catch (error) {
            // If Redis is down, allow the request through
            console.error('Rate limiter error:', error.message);
            next();
        }
    };
};

// Pre-configured rate limiters
export const loginLimiter = rateLimiter({
    windowMs: 60000, // 1 minute
    max: 5,
    keyPrefix: 'rl:login',
    message: 'Too many login attempts. Please try again after 1 minute.'
});

export const messageLimiter = rateLimiter({
    windowMs: 10000, // 10 seconds
    max: 20,
    keyPrefix: 'rl:message',
    message: 'You are sending messages too quickly. Please slow down.'
});
