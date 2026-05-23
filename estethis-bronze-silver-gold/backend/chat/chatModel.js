import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  userId:    { type: Number,  required: true },
  userEmail: { type: String,  required: true },
  userRole:  { type: String,  default: 'user' },
  content:   { type: String,  required: true, maxlength: 1000 },
  roomId:    { type: String,  required: true, default: 'general', index: true },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

export default mongoose.model('Message', messageSchema);
