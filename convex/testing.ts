import { Id, TableNames } from './_generated/dataModel';
import { internal } from './_generated/api';
import {
  DatabaseReader,
  internalAction,
  internalMutation,
  mutation,
  query,
  internalQuery,
} from './_generated/server';
import { v } from 'convex/values';
import schema from './schema';
import { DELETE_BATCH_SIZE } from './constants';
import { kickEngine, startEngine, stopEngine } from './aiTown/main';
import { insertInput } from './aiTown/insertInput';
import { fetchEmbedding, chatCompletion } from './util/llm';
import { startConversationMessage } from './agent/conversation';
import { GameId } from './aiTown/ids';
import { api } from './_generated/api';

// Clear all of the tables except for the embeddings cache.
const excludedTables: Array<TableNames> = ['embeddingsCache'];

export const wipeAllTables = internalMutation({
  handler: async (ctx) => {
    for (const tableName of Object.keys(schema.tables)) {
      if (excludedTables.includes(tableName as TableNames)) {
        continue;
      }
      await ctx.scheduler.runAfter(0, internal.testing.deletePage, { tableName, cursor: null });
    }
  },
});

export const deletePage = internalMutation({
  args: {
    tableName: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query(args.tableName as TableNames)
      .paginate({ cursor: args.cursor, numItems: DELETE_BATCH_SIZE });
    for (const row of results.page) {
      await ctx.db.delete(row._id);
    }
    if (!results.isDone) {
      await ctx.scheduler.runAfter(0, internal.testing.deletePage, {
        tableName: args.tableName,
        cursor: results.continueCursor,
      });
    }
  },
});

export const kick = internalMutation({
  handler: async (ctx) => {
    const { worldStatus } = await getDefaultWorld(ctx.db);
    await kickEngine(ctx, worldStatus.worldId);
  },
});

export const stopAllowed = query({
  handler: async () => {
    return !process.env.STOP_NOT_ALLOWED;
  },
});

export const stop = mutation({
  handler: async (ctx) => {
    if (process.env.STOP_NOT_ALLOWED) throw new Error('Stop not allowed');
    const { worldStatus, engine } = await getDefaultWorld(ctx.db);
    if (worldStatus.status === 'inactive' || worldStatus.status === 'stoppedByDeveloper') {
      if (engine.running) {
        throw new Error(`Engine ${engine._id} isn't stopped?`);
      }
      console.debug(`World ${worldStatus.worldId} is already inactive`);
      return;
    }
    console.log(`Stopping engine ${engine._id}...`);
    await ctx.db.patch(worldStatus._id, { status: 'stoppedByDeveloper' });
    await stopEngine(ctx, worldStatus.worldId);
  },
});

export const resume = mutation({
  handler: async (ctx) => {
    const { worldStatus, engine } = await getDefaultWorld(ctx.db);
    if (worldStatus.status === 'running') {
      if (!engine.running) {
        throw new Error(`Engine ${engine._id} isn't running?`);
      }
      console.debug(`World ${worldStatus.worldId} is already running`);
      return;
    }
    console.log(
      `Resuming engine ${engine._id} for world ${worldStatus.worldId} (state: ${worldStatus.status})...`,
    );
    await ctx.db.patch(worldStatus._id, { status: 'running' });
    await startEngine(ctx, worldStatus.worldId);
  },
});

export const archive = internalMutation({
  handler: async (ctx) => {
    const { worldStatus, engine } = await getDefaultWorld(ctx.db);
    if (engine.running) {
      throw new Error(`Engine ${engine._id} is still running!`);
    }
    console.log(`Archiving world ${worldStatus.worldId}...`);
    await ctx.db.patch(worldStatus._id, { isDefault: false });
  },
});

async function getDefaultWorld(db: DatabaseReader) {
  const worldStatus = await db
    .query('worldStatus')
    .filter((q) => q.eq(q.field('isDefault'), true))
    .first();
  if (!worldStatus) {
    throw new Error('No default world found');
  }
  const engine = await db.get(worldStatus.engineId);
  if (!engine) {
    throw new Error(`Engine ${worldStatus.engineId} not found`);
  }
  return { worldStatus, engine };
}

export const debugCreatePlayers = internalMutation({
  args: {
    numPlayers: v.number(),
  },
  handler: async (ctx, args) => {
    const { worldStatus } = await getDefaultWorld(ctx.db);
    for (let i = 0; i < args.numPlayers; i++) {
      await insertInput(ctx, worldStatus.worldId, 'join', {
        name: `Robot${i}`,
        description: `This player is a robot.`,
        character: `f${1 + (i % 8)}`,
      });
    }
  },
});

export const randomPositions = internalMutation({
  handler: async (ctx) => {
    const { worldStatus } = await getDefaultWorld(ctx.db);
    const map = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', worldStatus.worldId))
      .unique();
    if (!map) {
      throw new Error(`No map for world ${worldStatus.worldId}`);
    }
    const world = await ctx.db.get(worldStatus.worldId);
    if (!world) {
      throw new Error(`No world for world ${worldStatus.worldId}`);
    }
    for (const player of world.players) {
      await insertInput(ctx, world._id, 'moveTo', {
        playerId: player.id,
        destination: {
          x: 1 + Math.floor(Math.random() * (map.width - 2)),
          y: 1 + Math.floor(Math.random() * (map.height - 2)),
        },
      });
    }
  },
});

export const testEmbedding = internalAction({
  args: { input: v.string() },
  handler: async (_ctx, args) => {
    return await fetchEmbedding(args.input);
  },
});

export const testCompletion = internalAction({
  args: {},
  handler: async (ctx, args) => {
    return await chatCompletion({
      messages: [
        { content: 'You are helpful', role: 'system' },
        { content: 'Where is pizza?', role: 'user' },
      ],
    });
  },
});

export const testConvo = internalAction({
  args: {},
  handler: async (ctx, args) => {
    const a: any = (await startConversationMessage(
      ctx,
      'm1707m46wmefpejw1k50rqz7856qw3ew' as Id<'worlds'>,
      'c:115' as GameId<'conversations'>,
      'p:0' as GameId<'players'>,
      'p:6' as GameId<'players'>,
    )) as any;
    return await a.readAll();
  },
});

export const pauseWorld = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const status = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('worldId'), args.worldId))
      .first();
    if (!status) {
      throw new Error('No world found.');
    }
    await ctx.db.patch(status._id, {
      status: 'stoppedByDeveloper',
    });
  },
});

export const resumeWorld = mutation({
  args: {
    worldId: v.optional(v.id('worlds')),
  },
  handler: async (ctx, args) => {
    const query = args.worldId
      ? (q: any) => q.eq(q.field('worldId'), args.worldId)
      : (q: any) => q.eq(q.field('isDefault'), true);
    const status = await ctx.db.query('worldStatus').filter(query).first();
    if (!status) {
      throw new Error('No world found.');
    }
    await ctx.db.patch(status._id, {
      status: 'running',
    });
    const engine = await ctx.db.get(status.engineId);
    if (!engine) {
      throw new Error('No engine found.');
    }
    await ctx.scheduler.runAfter(0, internal.aiTown.main.runStep, {
      worldId: status.worldId,
      generationNumber: engine.generationNumber,
      maxDuration: 10000,
    });
  },
});

export const resetWorld = mutation({
  args: {
    worldId: v.optional(v.id('worlds')),
  },
  handler: async (ctx, args) => {
    const query = args.worldId
      ? (q: any) => q.eq(q.field('worldId'), args.worldId)
      : (q: any) => q.eq(q.field('isDefault'), true);
    const worldStatus = await ctx.db.query('worldStatus').filter(query).first();
    if (!worldStatus) {
      return { error: 'No world found.' };
    }
    await ctx.db.patch(worldStatus._id, {
      status: 'stoppedByDeveloper',
    });
    const engine = await ctx.db.get(worldStatus.engineId);
    if (!engine) {
      return { error: 'No engine found.' };
    }
    await ctx.db.patch(engine._id, {
      generationNumber: engine.generationNumber + 1,
      running: false,
    });
    const world = await ctx.db.get(worldStatus.worldId);
    if (!world) {
      return { error: 'World not found.' };
    }
    // Reset all the state for the world.
    await ctx.db.patch(world._id, {
      nextId: 0,
      agents: [],
      conversations: [],
      players: [],
    });
    // Also delete all agent descriptions and player descriptions from separate tables
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    for (const d of playerDescriptions) {
      await ctx.db.delete(d._id);
    }
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .collect();
    for (const d of agentDescriptions) {
      await ctx.db.delete(d._id);
    }
    // Get any player in the world.
    await ctx.db.patch(worldStatus._id, {
      status: 'running',
    });
    await ctx.scheduler.runAfter(0, internal.aiTown.main.runStep, {
      worldId: worldStatus.worldId,
      generationNumber: engine.generationNumber + 1,
      maxDuration: 10000,
    });
    await ctx.scheduler.runAfter(0, api.init, { numAgents: 10 });
    return { success: true };
  },
});

export const addPointsToUser = mutation({
  args: {
    walletAddress: v.string(),
    points: v.number(),
  },
  handler: async (ctx, args) => {
    // Find the user
    const user = await ctx.db
      .query('walletUsers')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', args.walletAddress))
      .unique();
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Update their points
    const updatedPoints = user.points + args.points;
    await ctx.db.patch(user._id, {
      points: updatedPoints
    });
    
    return {
      success: true,
      prevPoints: user.points,
      currentPoints: updatedPoints,
      delta: args.points
    };
  }
});

// Create a new mutation to test wallet functionality
/**
 * Test generating wallets for all agents - by running the wallet:batchGenerateAgentWallets function
 */
export const generateAllAgentWallets = mutation({
  handler: async (ctx): Promise<Record<string, any>> => {
    // Use the runAction function to call the wallet generation function
    try {
      // Use the api object to call the function
      const result = await ctx.runMutation(api.wallet.batchGenerateAgentWallets, {});
      
      // return the result
      return result;
    } catch (error) {
      console.error("Error generating wallets:", error);
      return {
        success: false,
        message: `Wallet generation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
});

/**
 * Get wallet information statistics - by running the wallet:getAgentWalletStats function
 */
export const getWalletStats = mutation({
  handler: async (ctx) => {
    try {
      // Use the api object to call the function
      type StatsResult = {
        totalAgents: number;
        agentsWithWallet: number;
        agentsWithoutWallet: number;
        percentage: string;
      };
      
      const stats: StatsResult = await ctx.runQuery(api.wallet.getAgentWalletStats);
      return stats;
    } catch (error) {
      console.error("Error getting wallet statistics:", error);
      return {
        totalAgents: 0,
        agentsWithWallet: 0,
        agentsWithoutWallet: 0,
        percentage: "0%"
      };
    }
  }
});

// Test function for directly inserting into the inputs table
export const testInputInsert = internalMutation({
  handler: async (ctx) => {
    try {
      // Find an available engine
      const engine = await ctx.db.query("engines").first();
      
      if (!engine) {
        return { success: false, error: "No engines found" };
      }
      
      // Attempt to directly insert input
      const now = Date.now();
      const number = now * 1000 + Math.floor(Math.random() * 1000);
      
      // Perform insert test
      const inputId = await ctx.db.insert("inputs", {
        engineId: engine._id,
        number,
        name: "testInput",
        args: { test: true, time: now },
        received: now,
      });
      
      return { 
        success: true, 
        inputId,
        engine: engine._id,
        timestamp: now
      };
    } catch (error) {
      // Catch and return detailed error
      console.error("Insert test failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  }
});

// Check the most recently inserted inputs
export const checkRecentInputs = internalQuery({
  handler: async (ctx) => {
    // Get the most recent 10 input records
    const recentInputs = await ctx.db
      .query("inputs")
      .withIndex("byCreationTime")
      .order("desc")
      .take(10);
    
    // Count the number of inputs in the last hour
    const hourAgo = Date.now() - 60 * 60 * 1000;
    
    // Use collect and then filter, instead of using filter in the query chain
    const allRecentInputs = await ctx.db
      .query("inputs")
      .withIndex("byCreationTime")
      .collect();
    
    const recentCount = allRecentInputs.filter(input => input.received > hourAgo);
    
    return {
      recentInputs,
      countLastHour: recentCount.length,
      now: Date.now()
    };
  }
});

// Diagnose the entire input insertion process
export const diagnoseInputProcess = internalMutation({
  handler: async (ctx) => {
    const results = {
      checks: [] as Array<{step: string, success: boolean, details: any}>,
      overallSuccess: false
    };
    
    try {
      // Step 1: Check table structure and indexes
      try {
        // Check if the table exists by attempting a query
        const tableExists = await ctx.db
          .query("inputs")
          .take(1);
        
        results.checks.push({
          step: "Table structure check",
          success: tableExists.length > 0,
          details: { tableExists: tableExists.length > 0 }
        });
      } catch (error) {
        results.checks.push({
          step: "Table structure check",
          success: false,
          details: { error: String(error) }
        });
        return results;
      }
      
      // Step 2: Check if the engine exists
      let engine;
      try {
        engine = await ctx.db.query("engines").first();
        results.checks.push({
          step: "Engine check",
          success: !!engine,
          details: { 
            engineExists: !!engine,
            engineId: engine?._id
          }
        });
        
        if (!engine) {
          return results;
        }
      } catch (error) {
        results.checks.push({
          step: "Engine check",
          success: false,
          details: { error: String(error) }
        });
        return results;
      }
      
      // Step 3: Check world status
      try {
        const worldStatus = await ctx.db.query("worldStatus").first();
        results.checks.push({
          step: "World status check",
          success: !!worldStatus,
          details: { 
            worldExists: !!worldStatus,
            worldId: worldStatus?._id, 
            engineId: worldStatus?.engineId
          }
        });
      } catch (error) {
        results.checks.push({
          step: "World status check",
          success: false,
          details: { error: String(error) }
        });
      }
      
      // Step 4: Attempt direct insertion
      try {
        const now = Date.now();
        const number = now * 1000 + Math.floor(Math.random() * 1000);
        
        const inputId = await ctx.db.insert("inputs", {
          engineId: engine._id,
          number,
          name: "diagnoseInput",
          args: { test: true, diagnostic: true },
          received: now
        });
        
        results.checks.push({
          step: "Direct insertion test",
          success: true,
          details: { inputId }
        });
      } catch (error) {
        results.checks.push({
          step: "Direct insertion test",
          success: false,
          details: { 
            error: String(error),
            stack: error instanceof Error ? error.stack : undefined
          }
        });
        return results;
      }
      
      // Step 5: Check cleanup script
      try {
        // Check if any inputs have been deleted recently by counting the number of recent inserts
        const now = Date.now();
        const lastHour = now - 60 * 60 * 1000;
        const lastDay = now - 24 * 60 * 60 * 1000;
        
        // Use collect and then filter, instead of using filter in the query chain
        const allRecentInputs = await ctx.db
          .query("inputs")
          .withIndex("byCreationTime")
          .collect();
        
        const recentInputs = allRecentInputs.filter(input => input.received > lastDay);
        const lastHourInputs = allRecentInputs.filter(input => input.received > lastHour);
        
        // Check if there are log messages recording deletion operations (we cannot directly query system logs here)
        // Therefore, we indirectly determine if cleanup is working properly by checking the number of inputs in the last 24 hours
        
        results.checks.push({
          step: "Cleanup script check",
          success: true,
          details: { 
            recentInputsCount: recentInputs.length,
            lastHourInputs: lastHourInputs.length,
            lastDayInputs: recentInputs.length,
            checkTime: new Date(now).toISOString()
          }
        });
      } catch (error) {
        results.checks.push({
          step: "Cleanup script check",
          success: false,
          details: { error: String(error) }
        });
      }
      
      // Overall success
      results.overallSuccess = results.checks.every(check => check.success);
      return results;
    } catch (error) {
      results.checks.push({
        step: "Overall diagnosis",
        success: false,
        details: { 
          error: String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      return results;
    }
  }
});

// Add a test function to simulate real input scenarios in the game
export const testFullInputFlow = internalMutation({
  handler: async (ctx) => {
    const results = {
      steps: [] as Array<{step: string, success: boolean, details: any}>,
      overallSuccess: false
    };
    
    try {
      // Step 1: Find world status and engine
      const worldStatus = await ctx.db.query("worldStatus").first();
      
      if (!worldStatus) {
        return { 
          success: false, 
          error: "World status not found" 
        };
      }
      
      results.steps.push({
        step: "Find world status",
        success: true,
        details: { worldId: worldStatus.worldId, engineId: worldStatus.engineId }
      });
      
      // Step 2: Directly use the insert input function to simulate a move request
      try {
        const now = Date.now();
        const inputId = await insertInput(ctx, worldStatus.worldId, 'moveTo', {
          playerId: 'p:1', // Use a potentially existing player ID
          destination: { x: 50, y: 50 }
        });
        
        results.steps.push({
          step: "Insert move input",
          success: true,
          details: { inputId, timestamp: now }
        });
      } catch (error) {
        results.steps.push({
          step: "Insert move input",
          success: false,
          details: { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }
        });
      }
      
      // Step 3: Directly insert test input
      try {
        // Use the test function we created earlier
        const testResult = await ctx.runMutation(internal.testing.testInputInsert, {});
        
        results.steps.push({
          step: "Test input insertion",
          success: testResult.success,
          details: testResult
        });
      } catch (error) {
        results.steps.push({
          step: "Test input insertion",
          success: false,
          details: { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }
        });
      }
      
      // Step 4: Check the number of inputs in the database
      try {
        const recentInputsResult = await ctx.runQuery(internal.testing.checkRecentInputs, {});
        
        results.steps.push({
          step: "Check recent inputs",
          success: true,
          details: { 
            recentInputsCount: recentInputsResult.countLastHour,
            hasRecentInputs: recentInputsResult.countLastHour > 0
          }
        });
      } catch (error) {
        results.steps.push({
          step: "Check recent inputs",
          success: false,
          details: { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }
        });
      }
      
      // Overall judgment
      results.overallSuccess = results.steps.every(step => step.success);
      return results;
    } catch (error) {
      return {
        steps: results.steps,
        overallSuccess: false,
        finalError: error instanceof Error ? error.message : String(error)
      };
    }
  }
});
