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

  // Players table - stores user-created player characters
  players: defineTable({
    // Associated wallet address
    walletAddress: v.string(),
    // Player name
    name: v.string(),
    // Character type
    character: v.string(),
    // AI-generated player description
    description: v.string(),
    // Creation timestamp
    createdAt: v.number(),
    // Associated world ID
    worldId: v.id('worlds'),
    // Game player ID, used to link data in the playerDescriptions table
    gamePlayerId: v.optional(v.string()),
  })
    .index('walletAddress', ['walletAddress']),

  // Frontend agents table - stores frontend-generated agent information
  frontendAgents: defineTable({
    // Unique identifier for the frontend agent (1-400)
    frontendAgentId: v.number(),
    // Agent name
    name: v.string(),
    // AI-generated agent description
    description: v.string(),
    // AI-generated conversation history
    conversation: v.array(v.object({
      role: v.string(),
      content: v.string(),
      timestamp: v.number(),
    })),
    // Agent status information (optional for backward compatibility)
    status: v.optional(v.object({
      emotion: v.string(),
      status: v.string(),
      current_work: v.string(),
      energy_level: v.string(),
      location: v.string(),
      mood_trend: v.string(),
    })),
    // Agent daily events (optional for backward compatibility)
    events: v.optional(v.array(v.object({
      time: v.string(),
      action: v.string(),
      details: v.string(),
    }))),
    // Last update timestamp
    lastUpdated: v.number(),
  })
    .index('frontendAgentId', ['frontendAgentId']),

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

  // Daily check-ins table - tracks user check-ins
  checkIns: defineTable({
    // Reference to the user who checked in
    userId: v.id('walletUsers'),
    // Wallet address for easier querying
    walletAddress: v.string(),
    // The date of check-in (as UTC timestamp)
    checkInDate: v.number(),
    // Points earned from this check-in
    pointsEarned: v.number(),
  })
    .index('userDaily', ['userId', 'checkInDate'])
    .index('walletAddress', ['walletAddress']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
