import { ObjectType, v } from 'convex/values';
import { GameId, agentId, parseGameId, playerId } from './ids';
import { internalQuery, internalMutation } from '../_generated/server';

export class AgentDescription {
  agentId: GameId<'agents'>;
  identity: string;
  plan: string;
  walletAddress?: string;  // agent  wallet address
  walletPublicKey?: string;
  encryptedPrivateKey?: string;
  energy: number; // Initial value 100, maximum value 100
  inferences: number; // Initial value 0
  tips: number; // Initial value 0, maximum value 10000
  avatarUrl?: string; // Agent avatar URL
  userWalletAddress?: string; // agent owner's wallet address
  status?: any; // Agent status information
  events?: any[]; // Agent daily events
  lastConversationTimestamp?: number; // Add timestamp for last conversation

  // --- Denormalized fields ---
  favoriteCount?: number;

  constructor(serialized: SerializedAgentDescription) {
    const { agentId, identity, plan, walletAddress, walletPublicKey, encryptedPrivateKey, energy, inferences, tips, avatarUrl, userWalletAddress, status, events, lastConversationTimestamp, favoriteCount } = serialized;
    this.agentId = parseGameId('agents', agentId);
    this.identity = identity;
    this.plan = plan;
    this.walletAddress = walletAddress;
    this.walletPublicKey = walletPublicKey;
    this.encryptedPrivateKey = encryptedPrivateKey;
    this.energy = energy ?? 100; // Default value is 100
    this.inferences = inferences ?? 0; // Default value is 0
    this.tips = tips ?? 0; // Default value is 0
    this.avatarUrl = avatarUrl;
    this.userWalletAddress = userWalletAddress;
    this.status = status;
    this.events = events;
    this.lastConversationTimestamp = lastConversationTimestamp; // Assign new field
    this.favoriteCount = favoriteCount;
  }

  serialize(): SerializedAgentDescription {
    const { agentId, identity, plan, walletAddress, walletPublicKey, encryptedPrivateKey, energy, inferences, tips, avatarUrl, userWalletAddress, status, events, lastConversationTimestamp, favoriteCount } = this;
    return { 
      agentId, 
      identity, 
      plan,
      walletAddress,
      walletPublicKey, 
      encryptedPrivateKey,
      energy,
      inferences,
      tips,
      avatarUrl,
      userWalletAddress,
      status,
      events,
      lastConversationTimestamp,
      favoriteCount, 
    };
  }
}

export const serializedAgentDescription = {
  agentId,
  identity: v.string(),
  plan: v.string(),
  walletAddress: v.optional(v.string()),
  walletPublicKey: v.optional(v.string()),
  encryptedPrivateKey: v.optional(v.string()),
  energy: v.optional(v.number()), // Initial value 100, maximum value 100
  inferences: v.optional(v.number()), // Initial value 0
  tips: v.optional(v.number()), // Initial value 0, maximum value 10000 (Represents total tip AMOUNT, rename if needed)
  avatarUrl: v.optional(v.string()), // Agent avatar URL
  userWalletAddress: v.optional(v.string()), // agent owner's wallet address
  // Agent status information (optional for backward compatibility)
  status: v.optional(
    v.union(
      v.array(v.object({
        title: v.string(),
        icon: v.string(),
      })),
      v.object({
        emotion: v.string(),
        status: v.string(),
        current_work: v.string(),
        energy_level: v.string(),
        location: v.string(),
        mood_trend: v.string(),
      })
    )
  ),
  // Agent daily events (optional for backward compatibility)
  events: v.optional(v.array(v.object({
    time: v.string(),
    action: v.string(),
    details: v.string(),
  }))),
  lastConversationTimestamp: v.optional(v.number()), // Add field to schema definition

  // --- Denormalized fields for performance ---
  favoriteCount: v.optional(v.number()), // Stores the number of times this agent was favorited
  // Note: 'tips' already exists, assuming it stores the SUM of tip amounts.
  // If you need the COUNT of tips, add a new field like tipCount: v.optional(v.number())
  
  // --- Potentially denormalize player data too ---
  // name: v.optional(v.string()), // Agent's display name (from playerDescription)
  // Consider if other player fields are frequently needed here
  // playerName: v.optional(v.string()),       // REMOVED
  // playerCharacter: v.optional(v.string()),  // REMOVED
};
export type SerializedAgentDescription = ObjectType<typeof serializedAgentDescription>;

// Query to get agent description by agentId
export const getAgentDescription = internalQuery({
  args: { agentId: agentId, worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    // Query by worldId and filter by agentId
    const descriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    return descriptions.find(d => d.agentId === args.agentId) || null;
  },
});

// Query to get agent description by playerId
export const getAgentDescriptionByPlayerId = internalQuery({
  args: { playerId: playerId, worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) return null;

    const agent = world.agents.find(a => a.playerId === args.playerId);
    if (!agent) {
      return null;
    }

    // Query by worldId and filter for the specific agentId
    const descriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    return descriptions.find(d => d.agentId === agent.id) || null;
  },
});

// NEW: Internal mutation to update energy and inferences
export const updateAgentStats = internalMutation({
  args: {
    agentDescriptionId: v.id('agentDescriptions'),
    energyDecrement: v.optional(v.number()), // Amount to decrease energy by (e.g., 1)
    inferencesIncrement: v.optional(v.number()), // Amount to increase inferences by (e.g., 1)
  },
  handler: async (ctx, args) => {
    const agentDesc = await ctx.db.get(args.agentDescriptionId);
    if (!agentDesc) {
      console.error(`AgentDescription not found: ${args.agentDescriptionId}`);
      return;
    }

    const currentEnergy = agentDesc.energy ?? 0;
    const currentInferences = agentDesc.inferences ?? 0;

    const energyDecrement = args.energyDecrement ?? 0;
    const inferencesIncrement = args.inferencesIncrement ?? 0;

    // Ensure energy doesn't go below 0
    const newEnergy = Math.max(0, currentEnergy - energyDecrement);
    const newInferences = currentInferences + inferencesIncrement;

    await ctx.db.patch(args.agentDescriptionId, {
      energy: newEnergy,
      inferences: newInferences,
    });
    console.log(`Updated Agent ${agentDesc.agentId}: Energy=${newEnergy}, Inferences=${newInferences}`);
  }
});


