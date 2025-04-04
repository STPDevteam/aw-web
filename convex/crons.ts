import { cronJobs } from 'convex/server';
import { DELETE_BATCH_SIZE, IDLE_WORLD_TIMEOUT, VACUUM_MAX_AGE, AGENT_ENERGY_HOURLY_REDUCTION } from './constants';
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { TableNames } from './_generated/dataModel';
import { v } from 'convex/values';

const crons = cronJobs();

crons.interval(
  'stop inactive worlds',
  { seconds: IDLE_WORLD_TIMEOUT / 1000 },
  internal.world.stopInactiveWorlds,
);

crons.interval('restart dead worlds', { seconds: 60 }, internal.world.restartDeadWorlds);

crons.daily('vacuum old entries', { hourUTC: 4, minuteUTC: 20 }, internal.crons.vacuumOldEntries);

// Clean up expired authentication challenges every 10 minutes
crons.interval('clean expired auth challenges', { minutes: 10 }, internal.crons.cleanExpiredAuthChallenges);

// Reduce agent energy by 5 points every hour
crons.interval('reduce agent energy', { hours: 1 }, internal.crons.reduceAgentEnergy);

// TODO: Uncomment this after the frontend agent API is properly set up
// // Update frontend agent conversations daily at 01:00 UTC
// crons.daily(
//   'update frontend agents',
//   { hourUTC: 1, minuteUTC: 0 },
//   internal.frontendAgent.updateAllFrontendAgentConversations
// );

export default crons;

const TablesToVacuum: TableNames[] = [
  // Clean out old conversations.
  'participatedTogether', 'archivedConversations', 'messages',

  // Inputs aren't useful unless you're trying to replay history.
  // If you want to support that, you should add a snapshot table, so you can
  // replay from a certain time period. Or stop vacuuming inputs and replay from
  // the beginning of time
  'inputs',

  // We can keep memories without their embeddings for inspection, but we won't
  // retrieve them when searching memories via vector search.
  'memories',
  // We can vacuum fewer tables without serious consequences, but the only
  // one that will cause issues over time is having >>100k vectors.
  'memoryEmbeddings',
];

export const vacuumOldEntries = internalMutation({
  args: {},
  handler: async (ctx, args) => {
    const before = Date.now() - VACUUM_MAX_AGE;
    for (const tableName of TablesToVacuum) {
      console.log(`Checking ${tableName}...`);
      const exists = await ctx.db
        .query(tableName)
        .withIndex('by_creation_time', (q) => q.lt('_creationTime', before))
        .first();
      if (exists) {
        console.log(`Vacuuming ${tableName}...`);
        await ctx.scheduler.runAfter(0, internal.crons.vacuumTable, {
          tableName,
          before,
          cursor: null,
          soFar: 0,
        });
      }
    }
  },
});

export const vacuumTable = internalMutation({
  args: {
    tableName: v.string(),
    before: v.number(),
    cursor: v.union(v.string(), v.null()),
    soFar: v.number(),
  },
  handler: async (ctx, { tableName, before, cursor, soFar }) => {
    const results = await ctx.db
      .query(tableName as TableNames)
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', before))
      .paginate({ cursor, numItems: DELETE_BATCH_SIZE });
    for (const row of results.page) {
      await ctx.db.delete(row._id);
    }
    if (!results.isDone) {
      await ctx.scheduler.runAfter(0, internal.crons.vacuumTable, {
        tableName,
        before,
        soFar: results.page.length + soFar,
        cursor: results.continueCursor,
      });
    } else {
      console.log(`Vacuumed ${soFar + results.page.length} entries from ${tableName}`);
    }
  },
});

/**
 * Clean up expired authentication challenges
 * This is run as a scheduled cron job to keep the authChallenges table clean
 * 
 * The function processes challenges in batches for better performance and
 * schedules additional runs if there are more expired challenges to clean up.
 */
export const cleanExpiredAuthChallenges = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const batchSize = 100; // Process in batches
    
    const expiredChallenges = await ctx.db
      .query('authChallenges')
      .withIndex('expiration', (q) => q.lt('expiresAt', now))
      .take(batchSize);
    
    let deletedCount = 0;
    for (const challenge of expiredChallenges) {
      await ctx.db.delete(challenge._id);
      deletedCount++;
    }
    
    // If we processed a full batch, there might be more to clean up
    if (expiredChallenges.length === batchSize) {
      // Schedule another run after a short delay
      await ctx.scheduler.runAfter(1, internal.crons.cleanExpiredAuthChallenges);
    }
    
    console.log(`Cleaned up ${deletedCount} expired auth challenges`);
    return { 
      deletedCount,
      scheduledAnotherRun: expiredChallenges.length === batchSize
    };
  },
});

/**
 * Reduce agent energy by a fixed amount every hour
 * This replaces the previous mechanism of reducing energy per conversation
 */
export const reduceAgentEnergy = internalMutation({
  handler: async (ctx) => {
    const agents = await ctx.db.query('agentDescriptions').collect(); // Collect all agents at once
    const updatedCount = agents.reduce((count, agentDesc) => {
      const currentEnergy = agentDesc.energy ?? 100; // Default is 100 if undefined
      if (currentEnergy > 0) {
        const newEnergy = Math.max(0, currentEnergy - AGENT_ENERGY_HOURLY_REDUCTION);
        ctx.db.patch(agentDesc._id, { energy: newEnergy });
        
        // Log energy reduction
        if (newEnergy === 0) {
          console.log(`Agent ${agentDesc.agentId} energy reduced to 0. Agent needs to recharge.`);
        }
        return count + 1; // Increment count for updated agents
      }
      return count; // No update, return current count
    }, 0);
    
    console.log(`Reduced energy for ${updatedCount} agents out of ${agents.length} processed`);
    return { processedCount: agents.length, updatedCount };
  },
});
