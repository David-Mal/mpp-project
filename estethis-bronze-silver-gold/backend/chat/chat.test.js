// ─────────────────────────────────────────────────────────────
// CHAT REPO TESTS — uses MongoMemoryServer (no real MongoDB needed)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as chatRepo from './chatRepo.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await chatRepo.clearAll();
});

const BASE = { userId: 1, userEmail: 'alice@test.com', userRole: 'user', roomId: 'general' };

describe('chatRepo.saveMessage', () => {
  it('saves and returns a message with _id and createdAt', async () => {
    const msg = await chatRepo.saveMessage({ ...BASE, content: 'Hello world' });
    expect(msg._id).toBeTruthy();
    expect(msg.content).toBe('Hello world');
    expect(msg.createdAt).toBeInstanceOf(Date);
  });

  it('stores userId, userEmail, userRole correctly', async () => {
    const msg = await chatRepo.saveMessage({ ...BASE, content: 'hi', userRole: 'admin', userId: 99 });
    expect(msg.userId).toBe(99);
    expect(msg.userRole).toBe('admin');
  });
});

describe('chatRepo.getHistory', () => {
  it('returns messages in chronological order (oldest first)', async () => {
    await chatRepo.saveMessage({ ...BASE, content: 'first' });
    await chatRepo.saveMessage({ ...BASE, content: 'second' });
    await chatRepo.saveMessage({ ...BASE, content: 'third' });
    const history = await chatRepo.getHistory('general');
    expect(history.map(m => m.content)).toEqual(['first', 'second', 'third']);
  });

  it('filters messages by roomId', async () => {
    await chatRepo.saveMessage({ ...BASE, content: 'in general', roomId: 'general' });
    await chatRepo.saveMessage({ ...BASE, content: 'in vip',     roomId: 'vip' });
    const general = await chatRepo.getHistory('general');
    expect(general).toHaveLength(1);
    expect(general[0].content).toBe('in general');
  });

  it('respects the limit parameter (returns last N)', async () => {
    for (let i = 0; i < 10; i++) {
      await chatRepo.saveMessage({ ...BASE, content: `msg ${i}` });
    }
    const history = await chatRepo.getHistory('general', 5);
    expect(history).toHaveLength(5);
    // Should be the LAST 5 messages (most recent), in ascending order.
    expect(history[4].content).toBe('msg 9');
  });

  it('returns empty array when room has no messages', async () => {
    const history = await chatRepo.getHistory('empty-room');
    expect(history).toEqual([]);
  });
});

describe('chatRepo.clearAll', () => {
  it('removes all messages', async () => {
    await chatRepo.saveMessage({ ...BASE, content: 'will be cleared' });
    await chatRepo.clearAll();
    const history = await chatRepo.getHistory('general');
    expect(history).toHaveLength(0);
  });
});
