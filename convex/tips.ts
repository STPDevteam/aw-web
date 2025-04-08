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
    
    // --- Update denormalized tips amount on agentDescription ---
    // This now uses the `tips` field as the sum of tip amounts
    const newTipsAmount = (agentDesc.tips || 0) + amount;
    // ----------------------------------------------------
    
    const newEnergy = Math.min(100, (agentDesc.energy || 0) + 10); // Add 10 energy points, but max is 100
    
    // Update agentDescription with new tips amount and energy
    await ctx.db.patch(agentDesc._id as Id<"agentDescriptions">, {
      tips: newTipsAmount, // Update the denormalized total tips amount
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
      newTips: newTipsAmount, // Return the updated total tips amount
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
    let playerDescription = null;
    if (playerInfo?.player) {
      const playerDesc = await ctx.db
        .query("playerDescriptions")
        .withIndex("worldId", q => q.eq("worldId", worldId).eq("playerId", playerInfo.player.id))
        .unique();
      
      if (playerDesc) {
        playerName = playerDesc.name;
        playerDescription = playerDesc.description;
      }
    }
    
    // Process recent tips to match the format in getAgentTippers
    const recentTips = await Promise.all(
      tips.slice(0, 5).map(async (tip) => {
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
      agentId,
      playerId: playerInfo?.player?.id,
      name: playerName,
      description: playerDescription,
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
      avatarUrl: agentDesc.avatarUrl || `https://worlf-fun.s3.ap-northeast-1.amazonaws.com/world.fun/${Math.floor(Math.random() * 30) + 1}.png`,
      recentTips: recentTips
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

// Migration to add avatarUrl to all agents
export const addAgentAvatars = mutation({
  handler: async (ctx) => {
    // Get all agent descriptions
    const agentDescriptions = await ctx.db
      .query("agentDescriptions")
      .collect();
    
    let updatedCount = 0;
    
    // Update each agent description
    for (let i = 1; i <= 100; i++) {
      const avatarUrl = `https://worlf-fun.s3.ap-northeast-1.amazonaws.com/world.fun/${i}.png`;
      const agentDesc = agentDescriptions[i - 1]; // Access the agent description by index
      
      // Only update if avatar is not set
      if (agentDesc) {
        await ctx.db.patch(agentDesc._id, {
          avatarUrl: avatarUrl
        });
        updatedCount++;
      }
    }
    
    return {
      success: true,
      updatedCount,
      message: `Added avatars to ${updatedCount} agent descriptions`
    };
  },
});

// Migration to fill initial values for all existing agent descriptions
// export const fillAgentInitialValues = mutation({
//   handler: async (ctx) => {
//     // Get all agent descriptions that have empty fields
//     const agentDescriptions = await ctx.db
//       .query("agentDescriptions")
//       .collect();
    
//     let updatedCount = 0;
    
//     // Update each agent description
//     for (const agentDesc of agentDescriptions) {
//       const updates: Record<string, any> = {};
      
//       // Check if each field is missing and add it to updates if needed
//       if (agentDesc.energy === undefined || agentDesc.energy === null) {
//         updates.energy = 100; // Initial energy value
//       }
      
//       if (agentDesc.inferences === undefined || agentDesc.inferences === null) {
//         updates.inferences = 0; // Initial inferences value
//       }
      
//       if (agentDesc.tips === undefined || agentDesc.tips === null) {
//         updates.tips = 0; // Initial tips value
//       }
      
//       // Only update if we have changes to make
//       if (Object.keys(updates).length > 0) {
//         await ctx.db.patch(agentDesc._id, updates);
//         updatedCount++;
//       }
//     }
    
//     return {
//       success: true,
//       updatedCount,
//       message: `Updated ${updatedCount} agent descriptions with initial values`
//     };
//   },
// });

// Update agent with wallet address and details
export const updateAgentWithWallet = mutation({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
    walletAddress: v.string(), // User's wallet address
    identity: v.string(),
    plan: v.string(),
  },
  handler: async (ctx, args) => {
    const { worldId, agentId, walletAddress, identity, plan } = args;
    
    // Verify if the user's wallet address is registered
    const user = await ctx.db
      .query('walletUsers')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .unique();
    
    if (!user) {
      // If the user is not registered, create a user account first
      await ctx.db.insert('walletUsers', {
        walletAddress: walletAddress,
        username: `User${walletAddress.slice(0, 6)}`,
        points: 0,
        lastLogin: Date.now(),
        createdAt: Date.now(),
      });
    }
    
    // Find the agent description
    const agentDesc = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('agentId', agentId))
      .unique();
      
    if (!agentDesc) {
      throw new Error(`Agent description not found for agentId: ${agentId}`);
    }
    
    // Check if the agent has already been bound to another user
    if (agentDesc.userWalletAddress && agentDesc.userWalletAddress !== walletAddress) {
      throw new Error('This agent has already been bound to another user');
    }
    
    // Update the agent's identity, plan, bound user wallet address, and set isCreated to true
    await ctx.db.patch(agentDesc._id, {
      identity,
      plan,
      userWalletAddress: walletAddress,
      isCreated: true // Mark the agent as created/claimed
    });
    
    return { 
      success: true,
      agentWalletAddress: agentDesc.walletAddress || ''
    };
  },
});

// Update player with new identity
export const updatePlayerWithIdentity = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const { worldId, playerId, name, description } = args;
    
    // Find the player description
    const playerDesc = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('playerId', playerId))
      .unique();
      
    if (!playerDesc) {
      throw new Error(`Player description not found for playerId: ${playerId}`);
    }
    
    // Update the player description
    await ctx.db.patch(playerDesc._id, {
      name,
      description
    });
    
    return { success: true };
  },
}); 