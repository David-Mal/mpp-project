import mongoose from 'mongoose';
import Message  from './chatModel.js';

function connected() {
  return mongoose.connection.readyState === 1;
}

export async function saveMessage({ userId, userEmail, userRole, content, roomId }) {
  if (!connected()) {
    // Graceful degradation when MongoDB is unavailable.
    return { _id: Date.now().toString(), userId, userEmail, userRole, content, roomId, createdAt: new Date() };
  }
  const doc = await Message.create({ userId, userEmail, userRole, content, roomId });
  return doc.toObject();
}

export async function getHistory(roomId, limit = 50) {
  if (!connected()) return [];
  const docs = await Message
    .find({ roomId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return docs.reverse();
}

// Used by tests to reset state between runs.
export async function clearAll() {
  if (!connected()) return;
  await Message.deleteMany({});
}
