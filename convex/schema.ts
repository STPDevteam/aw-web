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

  // Favorite agents table - stores the agents that users have favorited
  favoriteAgents: defineTable({
    // User ID (can be a wallet user or other users)
    userId: v.id('walletUsers'),
    // World ID
    worldId: v.id('worlds'),
    // Agent ID (using agentId)
    agentId: v.string(),
    // Favorite time
    createdAt: v.number(),
  })
    .index('byUser', ['userId'])
    .index('byUserAndAgent', ['userId', 'agentId'])
    .index('byWorldAndUser', ['worldId', 'userId']),

  // Tips for agents table - stores the tipping records users give to agents
  agentTips: defineTable({
    // World ID
    worldId: v.id('worlds'),
    // Agent ID
    agentId: v.string(),
    // User ID (wallet user)
    userId: v.id('walletUsers'),
    // User wallet address
    walletAddress: v.string(),
    // Tip amount
    amount: v.number(),
    // Tip time
    tippedAt: v.number(),
    // Tip transaction ID (optional)
    transactionId: v.string(),
    // Whether the transaction is verified
    verified: v.optional(v.boolean()),
    // Blockchain network
    network: v.optional(v.string()),
  })
    .index('byAgent', ['worldId', 'agentId'])
    .index('byUser', ['userId'])
    .index('byAgentAndTime', ['agentId', 'tippedAt'])
    .index('byWalletAddress', ['walletAddress']),

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
    // Frontend token for API request verification
    frontendToken: v.optional(v.string()),
    // Token timestamp for expiry checking
    tokenTimestamp: v.optional(v.number()),
  })
    .index('walletAddress', ['walletAddress'])
    .index('points', ['points']),

  // Allowed tip addresses - stores wallet addresses permitted to tip agents
  allowedTipAddresses: defineTable({
    // Wallet address that is allowed to tip
    walletAddress: v.string(),
    // When the address was added
    addedAt: v.number(),
    // Optional note about why this address was added
    note: v.optional(v.string()),
    // Whether this address is active (can be used to deactivate without deletion)
    isActive: v.boolean(),
  })
    .index('walletAddress', ['walletAddress'])
    .index('activeStatus', ['isActive']),

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

  // Digital Twins table - stores information about digital twins
  digitalTwins: defineTable({
    userWalletAddress: v.string(),
    name: v.string(),
    description: v.string(),
    profession: v.string(),
    interest: v.string(),
    createdAt: v.number(),
  })
    .index('by_userWalletAddress', ['userWalletAddress']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
