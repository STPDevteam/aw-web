import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Direct database mutation to increment agent inference count
 * This is called each time an agent generates a message
 */
export const incrementAgentInferences = internalMutation({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Get agent description directly from database
      const agentDesc = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', q => q.eq('worldId', args.worldId).eq('agentId', args.agentId))
        .unique();
      
      if (!agentDesc) {
        console.warn(`Agent description not found for ${args.agentId}`);
        return { success: false, error: 'Agent description not found' };
      }
      
      // Increment inferences count
      const currentInferences = agentDesc.inferences || 0;
      const newInferences = currentInferences + 1;
      
      // Update directly in database
      await ctx.db.patch(agentDesc._id, { inferences: newInferences });
      
      console.log(`[DB UPDATED] Agent ${args.agentId} inferences increased from ${currentInferences} to ${newInferences}`);
      return { success: true, newInferences };
    } catch (error) {
      console.error(`Error incrementing inferences for agent ${args.agentId}:`, error);
      return { success: false, error: String(error) };
    }
  },
}); 