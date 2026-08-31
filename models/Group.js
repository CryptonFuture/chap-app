const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    default: '',
    maxlength: 200
  },
  avatar: {
    type: String,
    default: ''
  },
  // public = anyone can join with code, private = invite only
  isPublic: {
    type: Boolean,
    default: false
  },
  roomCode: {
    type: String,
    unique: true,
    sparse: true
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

groupSchema.pre('save', function (next) {
  if (this.admin && !this.members.map(m => m.toString()).includes(this.admin.toString())) {
    this.members.push(this.admin);
  }
  // Generate room code for public rooms
  if (this.isPublic && !this.roomCode) {
    this.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Group', groupSchema);
