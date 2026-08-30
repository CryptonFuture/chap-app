const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const connectDB = require("../config/db");


const router = express.Router();

// Get all users (except current)
router.get('/', protect, async (req, res) => {
  try {
    await connectDB()
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('-password')
      .sort({ isOnline: -1, username: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
