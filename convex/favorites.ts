import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';

// Batch Favorite Agents
export const favoriteAgent = mutation({
  args: {
    userId: v.id('walletUsers'),
    worldId: v.id('worlds'),
    agentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, worldId, agentIds } = args;
    
    const results = [];
    
    for (const agentId of agentIds) {
      // Check if already favorited
      const existing = await ctx.db
        .query('favoriteAgents')
        .withIndex('byUserAndAgent', (q) => q.eq('userId', userId).eq('agentId', agentId))
        .first();
      
      if (existing) {
        results.push({ 
          agentId, 
          status: 'already_exists', 
          favoriteId: existing._id 
        });
        continue;
      }
      
      // Create new favorite
      const favoriteId = await ctx.db.insert('favoriteAgents', {
        userId,
        worldId,
        agentId,
        createdAt: Date.now(),
      });
      
      // --- Update denormalized count on agentDescription ---
      const agentDesc = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('agentId', agentId))
        .unique();
        
      if (agentDesc) {
        await ctx.db.patch(agentDesc._id, {
          favoriteCount: (agentDesc.favoriteCount || 0) + 1,
        });
      }
      // ----------------------------------------------------
      
      results.push({ 
        agentId, 
        status: 'created', 
        favoriteId 
      });
    }
    
    return {
      success: true,
      count: agentIds.length,
      results
    };
  },
});

// Batch Unfavorite Agents
export const unfavoriteAgent = mutation({
  args: {
    userId: v.id('walletUsers'),
    agentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, agentIds } = args;
    
    const results = [];
    
    for (const agentId of agentIds) {
      // Find favorite record
      const favorite = await ctx.db
        .query('favoriteAgents')
        .withIndex('byUserAndAgent', (q) => q.eq('userId', userId).eq('agentId', agentId))
        .first();
      
      if (!favorite) {
        results.push({ 
          agentId, 
          status: 'not_found' 
        });
        continue;
      }
      
      // Delete favorite
      await ctx.db.delete(favorite._id);
      
      // --- Update denormalized count on agentDescription ---
      const agentDesc = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', favorite.worldId).eq('agentId', agentId))
        .unique();
        
      if (agentDesc) {
        await ctx.db.patch(agentDesc._id, {
          // Ensure count doesn't go below 0
          favoriteCount: Math.max(0, (agentDesc.favoriteCount || 0) - 1),
        });
      }
      // ----------------------------------------------------
      
      results.push({ 
        agentId, 
        status: 'deleted' 
      });
    }
    
    return {
      success: true, 
      count: agentIds.length,
      results
    };
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