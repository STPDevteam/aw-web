import { cronJobs } from 'convex/server';
import { DELETE_BATCH_SIZE, IDLE_WORLD_TIMEOUT, VACUUM_MAX_AGE, AGENT_ENERGY_HOURLY_REDUCTION } from './constants';
import { internal } from './_generated/api';
import { internalMutation, internalQuery } from './_generated/server';
import { TableNames, Doc, Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { DatabaseReader, MutationCtx } from './_generated/server';

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

// Regularly clean up old inputs to prevent table growth
// Commenting out this line because there is already a cron job with the same name but different frequency
// crons.interval('clean old inputs', { minutes: 15 }, internal.crons.cleanOldInputs);

// Reduce agent energy by 5 points every hour
// DISABLED: Energy is now reduced with each message (inference) instead of on a schedule
// crons.interval('reduce agent energy', { hours: 1 }, internal.crons.reduceAgentEnergy);

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
      
      try {
        // Check if there is data in the table
        const exists = await ctx.db
          .query(tableName)
          .first();
        
        if (exists) {
          console.log(`Vacuuming ${tableName}...`);
          await ctx.scheduler.runAfter(0, internal.crons.vacuumTable, {
            tableName,
            before,
            cursor: null,
            soFar: 0
          });
        }
      } catch (error) {
        console.error(`Error checking table ${tableName}:`, error);
      }
    }
  },
});

export const vacuumTable = internalMutation({
  args: {
    tableName: v.string(),
    before: v.number(),
    cursor: v.union(v.string(), v.null()),
    soFar: v.number()
  },
  handler: async (ctx, { tableName, before, cursor, soFar }) => {
    // Use pagination to get a batch of data
    const results = await ctx.db
      .query(tableName as TableNames)
      .paginate({ cursor, numItems: DELETE_BATCH_SIZE });
    
    let deletedCount = 0;
    
    // Process each row of data
    for (const row of results.page) {
      // Check if it is old data
      let timestamp = row._creationTime; // Default to using _creationTime
      
      // For the inputs table, try using the received field
      if (tableName === 'inputs' && 'received' in row) {
        timestamp = row.received;
      }
      
      if (timestamp < before) {
        // If it is old data, delete it
        await ctx.db.delete(row._id);
        deletedCount++;
      }
    }
    
    // If there is more data to process, continue to the next batch
    if (!results.isDone) {
      await ctx.scheduler.runAfter(0, internal.crons.vacuumTable, {
        tableName,
        before,
        soFar: soFar + deletedCount,
        cursor: results.continueCursor
      });
    } else {
      // Finished processing, log the number of deletions
      console.log(`Vacuumed ${soFar + deletedCount} entries from ${tableName}`);
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
 * Clean up old inputs from the inputs table
 * This job runs hourly to prevent the inputs table from growing too large
 */
export const cleanOldInputs = internalMutation({
  handler: async (ctx) => {
    const db = ctx.db;
    const now = Date.now();
    
    // Increase retention time from 1 hour to 3 hours
    const processedThreshold = now - 3 * 60 * 60 * 1000; // 3 hours ago
    // Increase retention time for unprocessed inputs from 4 hours to 6 hours
    const unprocessedThreshold = now - 6 * 60 * 60 * 1000; // 6 hours ago
    
    // Reduce batch size to lessen database pressure
    const batchSize = 200; // Originally 300
    
    // Old processed inputs
    const processedInputs = await db
      .query("inputs")
      .withIndex("byCreationTime", (q) =>
        q.lt("received", processedThreshold)
      )
      .collect();
    
    // Filter out inputs that do not need to be retained
    const inputsToDelete = processedInputs.filter(input => {
      // Increase retention time for critical data types
      const criticalTypes = [
        "startConversation",
        "sendMessage",
        "finishConversation",
        "rememberInformation",
        "startDoSomething",
        "finishDoSomething",
      ];
      
      // If it is a critical data type, retain for a longer time (24 hours)
      if (input.name && criticalTypes.some(type => input.name.includes(type))) {
        return input.received < now - 24 * 60 * 60 * 1000;
      }
      
      return true;
    }).slice(0, batchSize);
    
    // Get very old unprocessed inputs (regardless of type)
    const unprocessedInputs = await db
      .query("inputs")
      .withIndex("byCreationTime", (q) =>
        q.lt("received", unprocessedThreshold)
      )
      .take(batchSize);
    
    let deleteCount = 0;
    
    // Delete old processed inputs
    for (const input of inputsToDelete) {
      await db.delete(input._id);
      deleteCount++;
    }
    
    // Delete very old unprocessed inputs
    for (const input of unprocessedInputs) {
      await db.delete(input._id);
      deleteCount++;
    }
    
    // Log the number of deleted inputs and the current timestamp
    if (deleteCount > 0) {
      console.log(`Deleted ${deleteCount} old inputs at ${new Date().toISOString()}`);
    }
    
    // Check the oldest unprocessed input to see if too much data has accumulated
    const oldestUnprocessed = await db
      .query("inputs")
      .withIndex("byCreationTime")
      .order("asc")
      .first();
    
    if (oldestUnprocessed && (now - oldestUnprocessed.received > 12 * 60 * 60 * 1000)) {
      console.warn(`Alert: Found unprocessed inputs older than 12 hours: ${oldestUnprocessed._id} from ${new Date(oldestUnprocessed.received).toISOString()}`);
    }
    
    return { deletedCount: deleteCount };
  }
});

// Add a cron job to run the cleanup task every hour
crons.interval('clean old inputs', { hours: 1 }, internal.crons.cleanOldInputs);

/**
 * Reduce agent energy by a fixed amount every hour
 * NOTE: This function is no longer used in the regular schedule.
 * Energy is now reduced by 1 with each message sent (when inference count increases).
 * This function is kept for potential future use or manual energy adjustments.
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
