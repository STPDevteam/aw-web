import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { Doc } from './_generated/dataModel';

// Mutation to tip an agent
export const tipAgent = mutation({
  args: {
    // World ID
    worldId: v.id('worlds'),
    // Agent ID
    agentId: v.string(),
    // User ID
    userId: v.id('walletUsers'),
    // Tip amount (fixed at 10)
    amount: v.optional(v.number()),
    // Transaction ID (optional)
    transactionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { worldId, agentId, userId, transactionId } = args;
    const amount = args.amount || 10; // Default tip amount is 10
    
    // Get user information
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User does not exist: ${userId}`);
    }
    
    // Verify if the agent exists
    const agentDesc = await ctx.db
      .query("agentDescriptions")
      .withIndex("worldId", q => q.eq("worldId", worldId).eq("agentId", agentId))
      .unique();
      
    if (!agentDesc) {
      throw new Error(`Agent does not exist: ${agentId}`);
    }
    
    // Update the total tips for the agent
    const newTips = (agentDesc.tips || 0) + amount;
    const newEnergy = Math.min(100, (agentDesc.energy || 0) + 10); // Increase energy by 10, but max value is 100
    
    // Update agentDescription - using type assertion
    await ctx.db.patch(agentDesc._id as Id<"agentDescriptions">, {
      tips: newTips,
      energy: newEnergy
    });
    
    // Record the tip
    const tipId = await ctx.db.insert('agentTips', {
      worldId,
      agentId,
      userId,
      walletAddress: user.walletAddress,
      amount,
      tippedAt: Date.now(),
      transactionId
    });
    
    return {
      success: true,
      tipId,
      agentId,
      newTips,
      newEnergy
    };
  },
});

// Get agent details, including tip history
export const getAgentDetails = query({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const { worldId, agentId } = args;
    
    // Get basic information about the agent
    const agentDesc = await ctx.db
      .query("agentDescriptions")
      .withIndex("worldId", q => q.eq("worldId", worldId).eq("agentId", agentId))
      .unique();
      
    if (!agentDesc) {
      throw new Error(`Agent does not exist: ${agentId}`);
    }
    
    // Get player information where the agent is located - fix query syntax
    const world = await ctx.db.get(worldId);
      
    let playerInfo = null;
    if (world) {
      const agent = world.agents.find(a => a.id === agentId);
      if (agent) {
        const player = world.players.find(p => p.id === agent.playerId);
        if (player) {
          playerInfo = { agent, player };
        }
      }
    }
    
    // Get the agent's tip history
    const tips = await ctx.db
      .query("agentTips")
      .withIndex("byAgent", q => q.eq("worldId", worldId).eq("agentId", agentId))
      .order("desc")
      .collect();
    
    // Calculate total tip amount
    const totalTipsAmount = tips.reduce((sum, tip) => sum + tip.amount, 0);
    
    // Get player description
    let playerName = "Unknown";
    if (playerInfo?.player) {
      const playerDesc = await ctx.db
        .query("playerDescriptions")
        .withIndex("worldId", q => q.eq("worldId", worldId).eq("playerId", playerInfo.player.id))
        .unique();
      
      if (playerDesc) {
        playerName = playerDesc.name;
      }
    }
    
    return {
      agentId,
      playerId: playerInfo?.player?.id,
      name: playerName,
      energy: agentDesc.energy || 0,
      maxEnergy: 100,
      inferences: agentDesc.inferences || 0,
      tips: agentDesc.tips || 0,
      maxTips: 10000,
      totalTipsAmount,
      tipsCount: tips.length,
      walletAddress: agentDesc.walletAddress,
      identity: agentDesc.identity,
      plan: agentDesc.plan,
      recentTips: tips.slice(0, 5) // Only return the most recent 5 tip records
    };
  },
});

// Get the list of users who have tipped a specific agent
export const getAgentTippers = query({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.id('agentTips')),
  },
  handler: async (ctx, args) => {
    const { worldId, agentId, cursor } = args;
    const limit = args.limit || 20;
    
    // Get tip records, sorted by time
    let tips: Doc<"agentTips">[] = [];
    
    if (cursor) {
      // If there is a cursor, get the record corresponding to the cursor
      const cursorDoc = await ctx.db.get(cursor);
      if (cursorDoc) {
        // Get records that are earlier than the timestamp of the cursor record
        tips = await ctx.db
          .query("agentTips")
          .withIndex("byAgent", q => q.eq("worldId", worldId).eq("agentId", agentId))
          .filter(q => q.lt("tippedAt", cursorDoc.tippedAt as any))
          .order("desc")
          .take(limit + 1);
      }
    } else {
      // If there is no cursor, directly get the latest records
      tips = await ctx.db
        .query("agentTips")
        .withIndex("byAgent", q => q.eq("worldId", worldId).eq("agentId", agentId))
        .order("desc")
        .take(limit + 1);
    }
    
    // Check if there are more results
    const hasMore = tips.length > limit;
    const results = hasMore ? tips.slice(0, limit) : tips;
    
    // Get user information for each tip record
    const tippersWithInfo = await Promise.all(
      results.map(async (tip) => {
        // Get user information
        const user = await ctx.db.get(tip.userId);
        return {
          tipId: tip._id,
          userId: tip.userId,
          walletAddress: tip.walletAddress,
          username: user?.username || "Anonymous",
          amount: tip.amount,
          tippedAt: tip.tippedAt,
          transactionId: tip.transactionId
        };
      })
    );
    
    return {
      tippers: tippersWithInfo,
      hasMore,
      cursor: hasMore && results.length > 0 ? results[results.length - 1]._id : null
    };
  },
}); 