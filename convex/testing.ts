import { Id, TableNames } from './_generated/dataModel';
import { internal } from './_generated/api';
import {
  DatabaseReader,
  internalAction,
  internalMutation,
  mutation,
  query,
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
