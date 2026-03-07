import User from '../user/user-model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redisClient from '../../config/redis.js';

// Generate access token (short-lived)
const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user._id, email: user.email, roleId: user.roleId },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
};

// Generate refresh token (long-lived)
const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

export const register = async (req, res) => {
    try {
        const { userName, firstName, lastName, email, password } = req.body;

        if (!email || !password || !userName || !firstName || !lastName) {
            return res.status(400).json({ message: 'Please enter all required fields' });
        }

        // Check duplicate email or username
        const existingUser = await User.findOne({
            $or: [{ email }, { userName }],
            isDeleted: false
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ message: 'Email already exists' });
            }
            if (existingUser.userName === userName) {
                return res.status(400).json({ message: 'Username already exists' });
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            userName,
            firstName,
            lastName,
            email,
            password: hashedPassword
        });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store refresh token
        user.refreshToken = refreshToken;
        await user.save();

        return res.status(201).json({
            message: 'User registered successfully',
            data: {
                id: user._id,
                userName: user.userName,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                pic: user.pic,
                token: accessToken,
                refreshToken
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email, isDeleted: false });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store refresh token
        user.refreshToken = refreshToken;
        await user.save();

        return res.json({
            message: 'Login successful',
            data: {
                id: user._id,
                userName: user.userName,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                pic: user.pic,
                roleId: user.roleId,
                token: accessToken,
                refreshToken
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        const token = req.token;

        // Blacklist the access token in Redis (expire when token would expire)
        const decoded = jwt.decode(token);
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
            await redisClient.setex(`bl:${token}`, ttl, '1');
        }

        // Clear refresh token from DB
        await User.findByIdAndUpdate(req.user._id, {
            refreshToken: null,
            isOnline: false,
            lastSeen: new Date()
        });

        // Remove from online users set in Redis
        await redisClient.srem('online_users', req.user._id.toString());

        return res.json({ message: 'Logged out successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const refreshToken = async (req, res) => {
    try {
        const { refreshToken: token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Refresh token is required' });
        }

        // Verify the refresh token
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

        const user = await User.findOne({ _id: decoded.id, refreshToken: token, isDeleted: false });
        if (!user) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        // Generate new tokens
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        // Update refresh token in DB
        user.refreshToken = newRefreshToken;
        await user.save();

        return res.json({
            data: {
                token: newAccessToken,
                refreshToken: newRefreshToken
            }
        });
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
};

export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -refreshToken')
            .lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({ data: user });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};
