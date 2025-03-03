import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';

export const updateVisibleAgents = mutation({
  args: {
    agentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get the current record
    const existingRecord = await ctx.db.query('visibleAgents').first();

    if (existingRecord) {
      // If record exists, replace it directly
      await ctx.db.replace(existingRecord._id, {
        agentIds: args.agentIds,
        updatedAt: now,
      });
    } else {
      // If record doesn't exist, insert a new one
      await ctx.db.insert('visibleAgents', {
        agentIds: args.agentIds,
        updatedAt: now,
      });
    }
  },
});
