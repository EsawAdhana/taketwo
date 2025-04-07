import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  name: {
    type: String,
    default: null // Will be null for direct messages, set for group chats
  },
  isGroup: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
});

// Index for faster queries
conversationSchema.index({ participants: 1 });

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

export default Conversation; 