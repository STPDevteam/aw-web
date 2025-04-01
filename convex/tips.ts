import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { Doc } from './_generated/dataModel';

// Function to generate frontend token - used for request verification
export const generateFrontendToken = mutation({
  args: {
    userId: v.id('walletUsers'),
  },
  handler: async (ctx, args) => {
    const { userId } = args;
    
    // Verify user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error('User does not exist');
    }
    
    // Generate token
    const timestamp = Date.now();
    const secretKey = process.env.FRONTEND_TOKEN_SECRET || 'frontend_token_secret_for_testing_only';
    
    // Create token components using timestamp, random values and user data
    const random1 = Math.floor(Math.random() * 10000000000);
    const random2 = Math.floor(Math.random() * 10000000000);
    
    // Create a simple hash by combining various elements
    const dataToSign = `${userId.toString()}_${timestamp}_${user.walletAddress}_${random1}_${random2}`;
    const token = simpleHash(dataToSign, secretKey);
      
    // Store token in database, overwrite previous token (if any)
    await ctx.db.patch(userId, {
      frontendToken: token,
      tokenTimestamp: timestamp
    });
    
    // Return token and timestamp
    return {
      token,
      timestamp,
      expiresIn: 30 * 60 * 1000, // 30 minute validity
    };
  }
});

// A simple hash function that doesn't require crypto
function simpleHash(str: string, salt: string): string {
  let hash = 0;
  const combinedStr = salt + str + salt;
  
  for (let i = 0; i < combinedStr.length; i++) {
    const char = combinedStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to hex-like string and add more entropy
  let hexHash = Math.abs(hash).toString(16);
  while (hexHash.length < 32) {
    // Add more pseudo-randomness based on timestamp and string content
    const extraRandom = Math.floor(Math.random() * 16777215).toString(16);
    hexHash += extraRandom;
  }
  
  return hexHash.slice(0, 64); // Return a 64-character string
}

// Tip agent endpoint - using frontend token verification
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
    // Frontend token
    frontendToken: v.string(),
    // Token timestamp
    tokenTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const { worldId, agentId, userId, transactionId, frontendToken, tokenTimestamp } = args;
    const amount = args.amount || 10; // Default tip amount is 10
    
    // Get user information
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User does not exist: ${userId}`);
    }
    
    // 1. Verify frontend token
    // Check if token has expired
    const currentTime = Date.now();
    const TOKEN_EXPIRY = 30 * 60 * 1000; // 30 minutes
    if (currentTime - tokenTimestamp > TOKEN_EXPIRY) {
      throw new Error('Token has expired, please refresh the page and try again');
    }
    
    // Check if token matches
    if (!user.frontendToken || user.frontendToken !== frontendToken || user.tokenTimestamp !== tokenTimestamp) {
      throw new Error('Invalid frontend token, please use the official frontend for tipping');
    }
    
    // Verify agent exists
    const agentDesc = await ctx.db
      .query("agentDescriptions")
      .withIndex("worldId", q => q.eq("worldId", worldId).eq("agentId", agentId))
      .unique();
      
    if (!agentDesc) {
      throw new Error(`Agent does not exist: ${agentId}`);
    }
    
    // Prevent duplicate tips - if transaction ID is provided, check it
    if (transactionId) {
      const existingTip = await ctx.db
        .query("agentTips")
        .filter(q => q.eq(q.field("transactionId"), transactionId))
        .first();
        
      if (existingTip) {
        throw new Error(`This tip has already been processed`);
      }
    }
    
    // Update agent's total tips
    const newTips = (agentDesc.tips || 0) + amount;
    const newEnergy = Math.min(100, (agentDesc.energy || 0) + 10); // Add 10 energy points, but max is 100
    
    // Update agentDescription - using type assertion
    await ctx.db.patch(agentDesc._id as Id<"agentDescriptions">, {
      tips: newTips,
      energy: newEnergy
    });
    
    // Generate unique transaction ID (if not provided)
    const finalTransactionId = transactionId || `tip_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Record the tip
    const tipId = await ctx.db.insert('agentTips', {
      worldId,
      agentId,
      userId,
      walletAddress: user.walletAddress,
      amount,
      tippedAt: Date.now(),
      transactionId: finalTransactionId,
      verified: true
    });
    
    // Invalidate token, ensure one-time use only
    await ctx.db.patch(userId, {
      frontendToken: undefined,
      tokenTimestamp: undefined
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