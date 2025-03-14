import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { agentTables } from './agent/schema';
import { aiTownTables } from './aiTown/schema';
import { conversationId, playerId } from './aiTown/ids';
import { engineTables } from './engine/schema';

export default defineSchema({
  music: defineTable({
    storageId: v.string(),
    type: v.union(v.literal('background'), v.literal('player')),
  }),

  messages: defineTable({
    conversationId,
    messageUuid: v.string(),
    author: playerId,
    text: v.string(),
    worldId: v.optional(v.id('worlds')),
  })
    .index('conversationId', ['worldId', 'conversationId'])
    .index('messageUuid', ['conversationId', 'messageUuid']),

  // Wallet users table - stores users who have connected their wallets
  walletUsers: defineTable({
    // Wallet address as the user's unique identifier
    walletAddress: v.string(),
    // Optional username
    username: v.optional(v.string()),
    // User's points (for future functionality)
    points: v.number(),
    // Last login timestamp
    lastLogin: v.number(),
    // Account creation timestamp
    createdAt: v.number(),
  })
    .index('walletAddress', ['walletAddress'])
    .index('points', ['points']),

  // Authentication challenges for wallet signature verification
  authChallenges: defineTable({
    // Wallet address the challenge is for
    walletAddress: v.string(),
    // The challenge message to sign
    challenge: v.string(),
    // When the challenge was created
    createdAt: v.number(),
    // When the challenge expires
    expiresAt: v.number(),
  })
    .index('walletAddress', ['walletAddress'])
    .index('expiration', ['expiresAt']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
