import User from "../routes/user/user-model.js";
import jwt from "jsonwebtoken";
import redisClient from "../config/redis.js";

export const token_middleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == 'null' || token == null) {
    return res.status(401).json({ message: 'User not authorized' });
  }

  try {
    // Check if token is blacklisted in Redis
    const isBlacklisted = await redisClient.get(`bl:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token has been invalidated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(400).json({ message: 'Invalid token payload' });
    }

    req.user = await User.findById(decoded.id).select("-password -refreshToken");
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.token = token;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};
