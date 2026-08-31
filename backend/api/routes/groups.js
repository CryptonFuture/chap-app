const express = require('express');
const Group = require('../../../models/Group');
const Message = require('../../../models/Message');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Create room
router.post('/', protect, upload.single('avatar'), async (req, res) => {
  try {
    const { name, description, members, isPublic } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    let memberIds = [];
    if (members) {
      memberIds = typeof members === 'string' ? JSON.parse(members) : members;
    }

    const group = await Group.create({
      name: name.trim(),
      description: description || '',
      admin: req.user._id,
      members: memberIds,
      isPublic: isPublic === 'true' || isPublic === true,
      avatar: req.file ? `/uploads/${req.file.filename}` : ''
    });

    const populated = await Group.findById(group._id)
      .populate('admin', 'username avatar')
      .populate('members', 'username avatar isOnline');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get my rooms
router.get('/', protect, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('admin', 'username avatar')
      .populate('members', 'username avatar isOnline')
      .sort({ updatedAt: -1 });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Discover public rooms
router.get('/discover/public', protect, async (req, res) => {
  try {
    const rooms = await Group.find({ isPublic: true })
      .populate('admin', 'username avatar')
      .populate('members', 'username avatar isOnline')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Join room by code
router.post('/join', protect, async (req, res) => {
  try {
    const { roomCode } = req.body;
    if (!roomCode) {
      return res.status(400).json({ message: 'Room code is required' });
    }

    const group = await Group.findOne({ roomCode: roomCode.toUpperCase().trim() });
    if (!group) {
      return res.status(404).json({ message: 'Room not found with this code' });
    }

    if (group.members.map(m => m.toString()).includes(req.user._id.toString())) {
      const populated = await Group.findById(group._id)
        .populate('admin', 'username avatar')
        .populate('members', 'username avatar isOnline');
      return res.json(populated);
    }

    group.members.push(req.user._id);
    await group.save();

    const populated = await Group.findById(group._id)
      .populate('admin', 'username avatar')
      .populate('members', 'username avatar isOnline');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Join public room by id
router.post('/:id/join', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Room not found' });
    }
    if (!group.isPublic) {
      return res.status(403).json({ message: 'This room is private' });
    }

    if (!group.members.map(m => m.toString()).includes(req.user._id.toString())) {
      group.members.push(req.user._id);
      await group.save();
    }

    const populated = await Group.findById(group._id)
      .populate('admin', 'username avatar')
      .populate('members', 'username avatar isOnline');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get room by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('admin', 'username avatar')
      .populate('members', 'username avatar isOnline');

    if (!group) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const isMember = group.members.some(m => m._id.toString() === req.user._id.toString());
    if (!isMember && !group.isPublic) {
      return res.status(403).json({ message: 'Not a member of this room' });
    }

    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update room
router.put('/:id', protect, upload.single('avatar'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Room not found' });
    }
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only admin can update room' });
    }

    if (req.body.name) group.name = req.body.name.trim();
    if (req.body.description !== undefined) group.description = req.body.description;
    if (req.body.isPublic !== undefined) {
      group.isPublic = req.body.isPublic === 'true' || req.body.isPublic === true;
      if (group.isPublic && !group.roomCode) {
        group.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      }
    }
    if (req.file) group.avatar = `/uploads/${req.file.filename}`;

    await group.save();

    const populated = await Group.findById(group._id)
      .populate('admin', 'username avatar')
      .populate('members', 'username avatar isOnline');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add members
router.post('/:id/members', protect, async (req, res) => {
  try {
    const { memberIds } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Room not found' });
    }
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only admin can add members' });
    }

    const ids = Array.isArray(memberIds) ? memberIds : [memberIds];
    ids.forEach(id => {
      if (!group.members.map(m => m.toString()).includes(id)) {
        group.members.push(id);
      }
    });

    await group.save();

    const populated = await Group.findById(group._id)
      .populate('admin', 'username avatar')
      .populate('members', 'username avatar isOnline');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Leave / remove member
router.delete('/:id/members/:userId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const isAdmin = group.admin.toString() === req.user._id.toString();
    const isSelf = req.params.userId === req.user._id.toString();

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    if (req.params.userId === group.admin.toString() && group.members.length > 1) {
      return res.status(400).json({ message: 'Admin cannot leave. Transfer admin or delete room.' });
    }

    group.members = group.members.filter(m => m.toString() !== req.params.userId);
    await group.save();

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete room
router.delete('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Room not found' });
    }
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only admin can delete room' });
    }

    await Message.deleteMany({ group: group._id });
    await group.deleteOne();

    res.json({ message: 'Room deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
