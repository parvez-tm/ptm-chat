import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: false },
  roleId: { type: Number, default: 4 }, // 1: Super Admin, 2: Admin, 3: Editor, 4: User
  dateOfBirth: { type: Date, required: false },
  phone: { type: String, required: false },
  address: { type: String, required: false },
  pic: {
    type: String,
    required: false,
    default: "no-user.jpg",
  },
  isOnline: { type: Boolean, default: false, index: true },
  lastSeen: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false, index: true },
  refreshToken: { type: String, default: null }
},
  { timestamps: true }
);

// Compound index for fetching active users
userSchema.index({ isDeleted: 1, isOnline: 1 });

const User = mongoose.model('User', userSchema);

export default User;