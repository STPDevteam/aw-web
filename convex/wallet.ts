import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { utils } from 'ethers';

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
        nextCheckIn: new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1
        )).getTime()
      };
    }
    
    // Award points
    await ctx.db.patch(user._id, {
      points: user.points + 10
    });
    
    // Get the updated user after adding points
    const updatedUser = await ctx.db.get(user._id);
    
    if (!updatedUser) {
      throw new ConvexError('Failed to update user points');
    }
    
    // Record check-in
    await ctx.db.insert('checkIns', {
      userId: user._id,
      walletAddress,
      checkInDate: today.getTime(),
      pointsEarned: 10
    });
    
    return {
      success: true,
      message: 'Successfully checked in and earned 10 points!',
      currentPoints: updatedUser.points,
      nextCheckIn: new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1
      )).getTime()
    };
  },
});

/**
 * Update user points
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
    
    await ctx.db.patch(user._id, {
      points: points
    });
    
    return { success: true };
  },
});

