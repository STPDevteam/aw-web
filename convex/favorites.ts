import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';

// Favorite Agent
export const favoriteAgent = mutation({
  args: {
    userId: v.id('walletUsers'),
    worldId: v.id('worlds'),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, worldId, agentId } = args;
    
    // Check if already favorited
    const existing = await ctx.db
      .query('favoriteAgents')
      .withIndex('byUserAndAgent', (q) => q.eq('userId', userId).eq('agentId', agentId))
      .first();
    
    if (existing) {
      return { status: 'already_exists', favoriteId: existing._id };
    }
    
    // Create new favorite
    const favoriteId = await ctx.db.insert('favoriteAgents', {
      userId,
      worldId,
      agentId,
      createdAt: Date.now(),
    });
    
    return { status: 'created', favoriteId };
  },
});

// Unfavorite Agent
export const unfavoriteAgent = mutation({
  args: {
    userId: v.id('walletUsers'),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, agentId } = args;
    
    // Find favorite record
    const favorite = await ctx.db
      .query('favoriteAgents')
      .withIndex('byUserAndAgent', (q) => q.eq('userId', userId).eq('agentId', agentId))
      .first();
    
    if (!favorite) {
      return { status: 'not_found' };
    }
    
    // Delete favorite
    await ctx.db.delete(favorite._id);
    
    return { status: 'deleted' };
  },
});

// Query all favorites of a user
export const getUserFavorites = query({
  args: {
    userId: v.id('walletUsers'),
    worldId: v.optional(v.id('worlds')),
  },
  handler: async (ctx, args) => {
    const { userId, worldId } = args;
    
    // If worldId is provided, return only favorites from that world
    if (worldId) {
      const favorites = await ctx.db
        .query('favoriteAgents')
        .withIndex('byWorldAndUser', (q) => q.eq('worldId', worldId).eq('userId', userId))
        .collect();
      return favorites;
    }
    
    // Otherwise, return all favorites
    const favorites = await ctx.db
      .query('favoriteAgents')
      .withIndex('byUser', (q) => q.eq('userId', userId))
      .collect();
    
    return favorites;
  },
});

// Check if agent is favorited
export const isAgentFavorited = query({
  args: {
    userId: v.id('walletUsers'),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, agentId } = args;
    
    const favorite = await ctx.db
      .query('favoriteAgents')
      .withIndex('byUserAndAgent', (q) => q.eq('userId', userId).eq('agentId', agentId))
      .first();
    
    return !!favorite;
  },
}); 