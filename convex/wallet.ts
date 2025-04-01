import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { utils } from 'ethers';
import { generateEncryptedEthWallet } from './util/ethWallet';
import process from 'process';
import { internal } from './_generated/api';
import { log } from 'console';

/**
 * Get wallet encryption key
 * 
 * Attempts to retrieve the wallet encryption key from environment variables, 
 * and if it fails, uses a backup hardcoded key.
 * Note: In production environments, only environment variables should be used, 
 * hardcoded keys should not be used.
 */
function getWalletEncryptionKey(): string {
  return '';
}

/**
 * Batch generate ETH wallets for all agents
 * This function uses an action to handle the generation of a large number of wallets, 
 * avoiding mutation timeout limits.
 */
export const batchGenerateAgentWallets = mutation({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    worldId: v.optional(v.id("worlds"))
  },
  handler: async (ctx, args) => {
    // Get encryption key
    const encryptionKey = getWalletEncryptionKey();
    
    // Limit the number of items processed, default is 10
    const limit = args.limit || 10;
    // Start processing from which item, default is 0
    const offset = args.offset || 0;
    
    // Get world ID
    let worldId = args.worldId;
    if (!worldId) {
      const world = await ctx.db.query("worlds").first();
      if (!world) {
        return { success: false, message: "World not found" };
      }
      worldId = world._id;
    }
    
    console.log(`Processing world ${worldId} (offset: ${offset}, limit: ${limit})`);
    
    // Get agent descriptions without wallets
    const allAgentsWithoutWallet = await ctx.db
      .query("agentDescriptions")
      .withIndex("worldId", (q) => q.eq("worldId", worldId))
      .filter(q => q.eq(q.field("walletAddress"), undefined))
      .collect();
    
    // Get total count and current batch
    const total = allAgentsWithoutWallet.length;
    const batch = allAgentsWithoutWallet.slice(offset, offset + limit);
    
    console.log(`Found a total of ${total} agents needing wallet generation, currently processing from ${offset + 1} to ${Math.min(offset + limit, total)}`);
    
    if (batch.length === 0) {
      return { 
        success: true, 
        message: "No agents to process", 
        total, 
        remaining: 0 
      };
    }
    
    let totalUpdated = 0;
    let errors = [];
    
    // Use Promise.all to process multiple agents' wallet generation in parallel
    // This allows processing more agents in a single function call
    const results = await Promise.all(batch.map(async (agent) => {
      try {
        console.log(`Generating wallet for agent ${agent.agentId}...`);
        const wallet = generateEncryptedEthWallet(encryptionKey);
        
        // Update agent description
        await ctx.db.patch(agent._id, {
          walletAddress: wallet.address,
          walletPublicKey: wallet.publicKey,
          encryptedPrivateKey: wallet.encryptedPrivateKey,
        });
        
        console.log(`Successfully generated wallet for agent ${agent.agentId}, address: ${wallet.address}`);
        return { success: true, agentId: agent.agentId };
      } catch (error) {
        console.error(`Error processing agent ${agent.agentId}:`, error);
        return { 
          success: false, 
          agentId: agent.agentId, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    }));
    
    // Count results
    for (const result of results) {
      if (result.success) {
        totalUpdated++;
      } else {
        errors.push({
          agentId: result.agentId,
          error: result.error
        });
      }
    }
    
    // Calculate remaining count
    const remaining = total - (offset + batch.length);
    
    return {
      success: true,
      processed: batch.length,
      totalUpdated,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully generated wallets for ${totalUpdated} agents`,
      total,
      remaining,
      nextOffset: offset + batch.length,
      completed: remaining === 0
    };
  },
});

/**
 * Query wallet information for all agents
 */
export const getAllAgentWallets = query({
  handler: async (ctx) => {
    const agentDescriptions = await ctx.db
      .query("agentDescriptions")
      .filter(q => q.neq(q.field("walletAddress"), undefined))
      .collect();
    
    return agentDescriptions.map(agent => ({
      agentId: agent.agentId,
      walletAddress: agent.walletAddress,
      hasPublicKey: !!agent.walletPublicKey,
      hasPrivateKey: !!agent.encryptedPrivateKey
    }));
  }
});

/**
 * Generate wallet for a single agent
 */
export const generateAgentWallet = mutation({
  args: {
    agentId: v.string(),
    worldId: v.id("worlds")
  },
  handler: async (ctx, args) => {
    // Get encryption key
    const encryptionKey = getWalletEncryptionKey();
    
    // Find agent description
    const agentDescription = await ctx.db
      .query("agentDescriptions")
      .withIndex("worldId", q => 
        q.eq("worldId", args.worldId).eq("agentId", args.agentId)
      )
      .unique();
    
    if (!agentDescription) {
      throw new ConvexError(`Agent not found: ${args.agentId}`);
    }
    
    // Check if wallet already exists
    if (agentDescription.walletAddress) {
      return {
        success: false,
        message: `Agent ${args.agentId} already has a wallet, address: ${agentDescription.walletAddress}`
      };
    }
    
    // Generate new wallet
    const wallet = generateEncryptedEthWallet(encryptionKey);
    
    // Update agent description
    await ctx.db.patch(agentDescription._id, {
      walletAddress: wallet.address,
      walletPublicKey: wallet.publicKey,
      encryptedPrivateKey: wallet.encryptedPrivateKey,
    });
    
    return {
      success: true,
      agentId: args.agentId,
      walletAddress: wallet.address,
      message: `Successfully generated wallet for agent ${args.agentId}, address: ${wallet.address}`
    };
  }
});

/** 
 * Check statistics of existing agent wallet information
 */
export const getAgentWalletStats = query({
  handler: async (ctx) => {
    const allAgentDescriptions = await ctx.db.query("agentDescriptions").collect();
    const totalAgents = allAgentDescriptions.length;
    
    const agentsWithWallet = allAgentDescriptions.filter(agent => !!agent.walletAddress);
    const agentsWithoutWallet = allAgentDescriptions.filter(agent => !agent.walletAddress);
    
    return {
      totalAgents,
      agentsWithWallet: agentsWithWallet.length,
      agentsWithoutWallet: agentsWithoutWallet.length,
      percentage: totalAgents > 0 ? (agentsWithWallet.length / totalAgents * 100).toFixed(2) + '%' : '0%'
    };
  }
});

/**
 * Get user by wallet address
 */
export const getUserByWalletAddress = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('walletUsers')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', args.walletAddress))
      .unique();
  },
});

/**
 * Wallet login or registration
 * 
 * This function handles user login via wallet address.
 * It doesn't verify signatures here - that should be done client-side
 * with a wallet provider like MetaMask, WalletConnect, etc.
 */
export const walletLogin = mutation({
  args: {
    walletAddress: v.string(),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query('walletUsers')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', args.walletAddress))
      .unique();

    const now = Date.now();
    
    if (existingUser) {
      // User exists, update last login time
      const updatedUser = await ctx.db.patch(existingUser._id, { 
        lastLogin: now,
        // Update username if provided
        ...(args.username ? { username: args.username } : {})
      });
      
      return { 
        user: updatedUser,
        isNewUser: false
      };
    } else {
      // Create new user
      const userId = await ctx.db.insert('walletUsers', {
        walletAddress: args.walletAddress,
        username: args.username || `User${args.walletAddress.slice(0, 6)}`,
        points: 0, // Initialize with 0 points
        lastLogin: now,
        createdAt: now,
      });
      
      return { 
        user: await ctx.db.get(userId),
        isNewUser: true
      };
    }
  },
});

/**
 * Verify if a wallet address is registered
 */
export const isWalletRegistered = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('walletUsers')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', args.walletAddress))
      .unique();
    
    return !!user;
  },
});

/**
 * Get current user information
 * This function would be expanded when additional auth mechanisms are added
 */
export const getCurrentUser = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('walletUsers')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', args.walletAddress))
      .unique();
    
    if (!user) {
      return null;
    }
    
    return {
      _id: user._id,
      walletAddress: user.walletAddress,
      username: user.username,
      points: user.points,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };
  },
});

/**
 * Create an authentication challenge for a wallet address
 * This generates a unique message that the user will sign with their wallet
 */
export const createAuthChallenge = mutation({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const { walletAddress } = args;
    
    // Validate wallet address format with more comprehensive check
    // Ethereum addresses are 42 characters long (including '0x' prefix) and contain hexadecimal characters
    if (!walletAddress.startsWith('0x') || 
        walletAddress.length !== 42 || 
        !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      throw new ConvexError('Invalid wallet address format');
    }
    
    // Delete any existing challenges for this wallet address
    const existingChallenges = await ctx.db
      .query('authChallenges')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .collect();
      
    for (const challenge of existingChallenges) {
      await ctx.db.delete(challenge._id);
    }
    
    // Create a new random challenge message with improved randomness
    const timestamp = new Date().toISOString();
    // Use a combination of techniques to create a more secure random string
    const randomPart1 = Math.random().toString(36).substring(2, 15);
    const randomPart2 = Date.now().toString(36);
    const randomPart3 = Math.floor(Math.random() * 1000000).toString(16);
    const randomString = `${randomPart1}_${randomPart2}_${randomPart3}`;
    const challenge = `Sign this message to verify you own this wallet address: ${randomString} - ${timestamp}`;
    
    // Set challenge expiration (5 minutes from now)
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes
    
    // Store the challenge
    const challengeId = await ctx.db.insert('authChallenges', {
      walletAddress,
      challenge,
      createdAt: now,
      expiresAt,
    });
    
    return {
      challenge,
      expiresAt,
    };
  },
});

/**
 * Verify a signature against a stored challenge
 * 
 * This implementation uses the ethers.js library to verify Ethereum signatures
 * with enhanced security measures and error handling
 */
export const verifySignature = mutation({
  args: {
    walletAddress: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const { walletAddress, signature } = args;
    
    // Validate input parameters
    if (!signature || signature.length < 65) { // Ethereum signatures are at least 65 bytes
      throw new ConvexError('Invalid signature format');
    }
    
    // Validate wallet address format
    if (!walletAddress.startsWith('0x') || 
        walletAddress.length !== 42 || 
        !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      throw new ConvexError('Invalid wallet address format');
    }
    
    // Find the latest challenge for this wallet address
    const challenge = await ctx.db
      .query('authChallenges')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .order('desc')
      .first();
    
    // Verify the challenge exists and hasn't expired
    if (!challenge) {
      throw new ConvexError('No challenge found for this wallet address');
    }
    
    if (Date.now() > challenge.expiresAt) {
      await ctx.db.delete(challenge._id); // Delete expired challenge
      throw new ConvexError('Challenge has expired. Please request a new one');
    }
    
    try {
      // Use ethers.utils.verifyMessage method to verify signature (for ethers v5)
      const recoveredAddress = utils.verifyMessage(challenge.challenge, signature);
      
      // Ensure the recovered address matches the provided wallet address (case insensitive)
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        // Security measure: delete the challenge if signature verification fails to prevent brute force attacks
        await ctx.db.delete(challenge._id);
        throw new ConvexError('Signature verification failed: address mismatch');
      }
      
      // Delete the used challenge
      await ctx.db.delete(challenge._id);
      
      // If verification is successful, proceed with login using the same logic as walletLogin
      // Check if user already exists
      const existingUser = await ctx.db
        .query('walletUsers')
        .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
        .unique();

      const now = Date.now();
      
      if (existingUser) {
        // User exists, update last login time
        const updatedUser = await ctx.db.patch(existingUser._id, { 
          lastLogin: now
        });
        
        return { 
          user: updatedUser,
          isNewUser: false
        };
      } else {
        // Create new user with a consistent username format (same as walletLogin)
        const userId = await ctx.db.insert('walletUsers', {
          walletAddress: walletAddress,
          username: `User${walletAddress.slice(0, 6)}`,
          points: 0, // Initialize with 0 points
          lastLogin: now,
          createdAt: now,
        });
        
        return { 
          user: await ctx.db.get(userId),
          isNewUser: true
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ConvexError(`Signature verification failed: ${errorMessage}`);
    }
  },
});

/**
 * Clean up expired auth challenges
 * This function is designed to handle large numbers of expired challenges efficiently
 * by processing them in smaller batches.
 */
export const cleanupExpiredChallenges = mutation({
  handler: async (ctx) => {
    const now = Date.now();
    const batchSize = 100; // Process in smaller batches to avoid performance issues
    
    // Get the first batch of expired challenges
    const expiredChallenges = await ctx.db
      .query('authChallenges')
      .withIndex('expiration', (q) => q.lt('expiresAt', now))
      .take(batchSize);
    
    let deletedCount = 0;
    
    // Delete the challenges in this batch
    for (const challenge of expiredChallenges) {
      await ctx.db.delete(challenge._id);
      deletedCount++;
    }
    
    // If we got a full batch, there might be more to delete
    // In a production system, you might want to schedule another cleanup
    // task to continue processing if there are more expired challenges
    const mightHaveMore = expiredChallenges.length === batchSize;
    
    return { 
      deletedCount, 
      mightHaveMore
    };
  },
});

/**
 * Get the current check-in status for a user
 */
export const getCheckInStatus = query({
  args: {
    walletAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { walletAddress } = args;
    
    // Return null if no wallet address is provided
    if (!walletAddress) {
      return null;
    }
    
    // Get the current user
    const user = await ctx.db
      .query('walletUsers')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .unique();
    
    if (!user) {
      return null;
    }
    
    // Get current date in UTC
    const now = new Date();
    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ));
    
    // The next reset time (UTC midnight)
    const nextResetTime = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    ));
    
    // Check if user has already checked in today
    const existingCheckIn = await ctx.db
      .query('checkIns')
      .withIndex('userDaily', (q) => 
        q.eq('userId', user._id).gte('checkInDate', today.getTime())
      )
      .unique();
    
    return {
      canCheckIn: !existingCheckIn,
      nextResetTime: nextResetTime.getTime(),
      currentPoints: user.points,
      lastCheckIn: existingCheckIn ? existingCheckIn.checkInDate : null,
    };
  },
});

/**
 * Daily check-in functionality
 * 
 * Allows users to check in once per day (based on UTC time) and earn 10 points.
 * The check-in status resets at UTC 00:00.
 */
export const dailyCheckIn = mutation({
  args: {
    walletAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { walletAddress } = args;
    
    // Return friendly message if no wallet address is provided
    if (!walletAddress) {
      return {
        success: false,
        message: 'Please provide a wallet address',
        currentPoints: null,
        nextCheckIn: null
      };
    }
    
    // Get the current user
    const user = await ctx.db
      .query('walletUsers')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .unique();
    
    if (!user) {
      return {
        success: false,
        message: 'Please connect your wallet first',
        currentPoints: null,
        nextCheckIn: null
      };
    }
    
    // Get current date in UTC
    const now = new Date();
    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ));
    
    // Calculate the next reset time (UTC midnight)
    const nextResetTime = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    ));
    
    // Check if user has already checked in today
    const existingCheckIn = await ctx.db
      .query('checkIns')
      .withIndex('userDaily', (q) => 
        q.eq('userId', user._id).gte('checkInDate', today.getTime())
      )
      .unique();
    
    if (existingCheckIn) {
      return {
        success: false,
        message: 'You have already checked in today',
        currentPoints: user.points,
        nextCheckIn: nextResetTime.getTime()
      };
    }
    
    // Award 10 points for checking in
    const pointsToAward = 10;
    const updatedPoints = user.points + pointsToAward;
    
    // Update user points
    await ctx.db.patch(user._id, {
      points: updatedPoints
    });
    
    // Record the check-in
    await ctx.db.insert('checkIns', {
      userId: user._id,
      walletAddress: walletAddress,
      checkInDate: now.getTime(),
      pointsEarned: pointsToAward
    });
    
    return {
      success: true,
      message: `Check-in successful! You earned ${pointsToAward} points.`,
      pointsEarned: pointsToAward,
      currentPoints: updatedPoints,
      nextCheckIn: nextResetTime.getTime()
    };
  },
});

/**
 * Leaderboard query - Get top users by points
 */
export const getUsersLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10; // Default to 10 users
    
    const topUsers = await ctx.db
      .query('walletUsers')
      .withIndex('points', (q) => q)
      .order('desc')
      .take(limit);
    
    return topUsers.map((user, index) => ({
      rank: index + 1,
      walletAddress: user.walletAddress,
      username: user.username,
      points: user.points
    }));
  },
});

/**
 * Update user points - intended for internal use by other mutations
 */
export const updateUserPoints = mutation({
  args: {
    walletAddress: v.string(),
    points: v.number(),
  },
  handler: async (ctx, args) => {
    const { walletAddress, points } = args;
    
    const user = await ctx.db
      .query('walletUsers')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .unique();
    
    if (!user) {
      throw new ConvexError('User not found');
    }
    
    return await ctx.db.patch(user._id, {
      points
    });
  },
});

/**
 * A simple test function to check if code updates are being applied
 */
export const testWalletFunction = query({
  handler: async (ctx) => {
    return {
      success: true,
      message: "Test function is working!",
      timestamp: Date.now()
    };
  }
});


/**
 * Helper function to generate wallets for all agents - automatically handles pagination
 * This function will automatically call batchGenerateAgentWallets multiple times until all agents are processed
 * Returns processing progress and final results
 */
export const generateAllAgentWallets = mutation({
  args: {
    batchSize: v.optional(v.number()),
    worldId: v.optional(v.id("worlds"))
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    batchCount: number;
    totalProcessed: number;
    totalUpdated: number;
    total: number;
    errors?: Array<{agentId: string, error: string}>;
    message: string;
  }> => {
    const batchSize = args.batchSize || 10;
    const worldId = args.worldId;
    
    console.log("Starting batch wallet generation process with parameters:", { batchSize, worldId });
    
    // Get wallet encryption key
    const encryptionKey = getWalletEncryptionKey();
    console.log("Wallet encryption key found:", !!encryptionKey);
    
    let offset = 0;
    let total = 0;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let allErrors: Array<{agentId: string, error: string}> = [];
    let complete = false;
    let batchCount = 0;
    
    // Loop to process all agents
    while (!complete) {
      batchCount++;
      console.log(`Processing batch #${batchCount}, offset=${offset}, batchSize=${batchSize}`);
      
      // Directly call batchGenerateAgentWallets in the same function
      const args = {
        limit: batchSize,
        offset,
        worldId
      };
      
      // Directly execute batch processing instead of using runMutation
      try {
        const result = await batchGenerateAgentWalletsDirectly(ctx, args);
        
        // Get total count on the first loop
        if (batchCount === 1) {
          total = result.total || 0;
        }
        
        // Accumulate processing results
        if (result.processed) {
          totalProcessed += result.processed;
        }
        
        if (result.totalUpdated) {
          totalUpdated += result.totalUpdated;
        }
        
        if (result.errors && result.errors.length > 0) {
          allErrors = [...allErrors, ...result.errors];
        }
        
        // Exit loop if processing is complete or an error occurs
        if (result.completed || result.remaining === 0 || !result.success) {
          complete = true;
        } else {
          // Update offset to process the next batch
          offset = result.nextOffset || 0;
        }
      } catch (error) {
        console.error("Error during batch processing:", error);
        allErrors.push({
          agentId: "batch-error",
          error: error instanceof Error ? error.message : String(error)
        });
        complete = true;
      }
    }
    
    return {
      success: true,
      batchCount,
      totalProcessed,
      totalUpdated,
      total,
      errors: allErrors.length > 0 ? allErrors : undefined,
      message: `Batch processing completed, processed a total of ${totalProcessed} agents, successfully generated ${totalUpdated} wallets`
    };
  }
});

// Helper function - directly calls the batch processing function without going through mutation
async function batchGenerateAgentWalletsDirectly(
  ctx: any, 
  args: { 
    limit?: number; 
    offset?: number; 
    worldId?: any;
  }
) {
  // Get encryption key
  const encryptionKey = getWalletEncryptionKey();
  
  // Limit the number of items processed, default is 10
  const limit = args.limit || 10;
  // Start processing from which item, default is 0
  const offset = args.offset || 0;
  
  // Get world ID
  let worldId = args.worldId;
  if (!worldId) {
    const world = await ctx.db.query("worlds").first();
    if (!world) {
      return { success: false, message: "World not found" };
    }
    worldId = world._id;
  }
  
  // Get agent descriptions without wallets
  const allAgentsWithoutWallet = await ctx.db
    .query("agentDescriptions")
    .withIndex("worldId", (q: any) => q.eq("worldId", worldId))
    .filter((q: any) => q.eq(q.field("walletAddress"), undefined))
    .collect();
  
  // Get total count and current batch
  const total = allAgentsWithoutWallet.length;
  const batch = allAgentsWithoutWallet.slice(offset, offset + limit);
  
  console.log(`Found a total of ${total} agents needing wallet generation, currently processing from ${offset + 1} to ${Math.min(offset + limit, total)}`);
  
  if (batch.length === 0) {
    return { 
      success: true, 
      message: "No agents to process", 
      total, 
      remaining: 0 
    };
  }
  
  let totalUpdated = 0;
  let errors: Array<{agentId: string, error: string}> = [];
  
  // Use Promise.all to process multiple agents' wallet generation in parallel
  const results = await Promise.all(batch.map(async (agent: any) => {
    try {
      console.log(`Generating wallet for agent ${agent.agentId}...`);
      const wallet = generateEncryptedEthWallet(encryptionKey);
      
      // Update agent description
      await ctx.db.patch(agent._id, {
        walletAddress: wallet.address,
        walletPublicKey: wallet.publicKey,
        encryptedPrivateKey: wallet.encryptedPrivateKey,
      });
      
      console.log(`Successfully generated wallet for agent ${agent.agentId}, address: ${wallet.address}`);
      return { success: true, agentId: agent.agentId };
    } catch (error) {
      console.error(`Error processing agent ${agent.agentId}:`, error);
      return { 
        success: false, 
        agentId: agent.agentId, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }));
  
  // Count results
  for (const result of results) {
    if (result.success) {
      totalUpdated++;
    } else {
      errors.push({
        agentId: result.agentId,
        error: result.error
      });
    }
  }
  
  // Calculate remaining count
  const remaining = total - (offset + batch.length);
  
  return {
    success: true,
    processed: batch.length,
    totalUpdated,
    errors: errors.length > 0 ? errors : undefined,
    message: `Successfully generated wallets for ${totalUpdated} agents`,
    total,
    remaining,
    nextOffset: offset + batch.length,
    completed: remaining === 0
  };
}

