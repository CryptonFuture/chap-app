const express = require('express');
const Message = require('../../../models/Message');
const Group = require('../../../models/Group');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Get public messages
router.get('/public', protect, async (req, res) => {
  try {
    const messages = await Message.find({ receiver: null, group: null })
      .populate('sender', 'username avatar')
      .sort({ createdAt: 1 })
      .limit(150);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get private messages
router.get('/private/:userId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ],
      group: null
    })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: 1 })
      .limit(150);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get group messages
router.get('/group/:groupId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isMember = group.members.some(m => m.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const messages = await Message.find({ group: req.params.groupId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: 1 })
      .limit(150);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload file/image (returns URL - actual message sent via socket)
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(req.file.originalname) ||
      req.file.mimetype.startsWith('image/');

    res.json({
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      messageType: isImage ? 'image' : 'file'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark private messages as read
router.put('/read/:userId', protect, async (req, res) => {
  try {
    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
