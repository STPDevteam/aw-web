import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { paginationOptsValidator } from 'convex/server';
import { characters } from '../data/characters';
import { insertInput } from './aiTown/insertInput';
import {
  DEFAULT_NAME,
  ENGINE_ACTION_DURATION,
  IDLE_WORLD_TIMEOUT,
  WORLD_HEARTBEAT_INTERVAL,
} from './constants';
import { playerId } from './aiTown/ids';
import { kickEngine, startEngine, stopEngine } from './aiTown/main';
import { engineInsertInput } from './engine/abstractGame';
import { Id } from './_generated/dataModel';
import { SerializedPlayerDescription } from './aiTown/playerDescription';

export const defaultWorldStatus = query({
  handler: async (ctx) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    return worldStatus;
  },
});

export const heartbeatWorld = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!worldStatus) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    const now = Date.now();

    // Skip the update (and then potentially make the transaction readonly)
    // if it's been viewed sufficiently recently..
    if (!worldStatus.lastViewed || worldStatus.lastViewed < now - WORLD_HEARTBEAT_INTERVAL / 2) {
      await ctx.db.patch(worldStatus._id, {
        lastViewed: Math.max(worldStatus.lastViewed ?? now, now),
      });
    }

    // Restart inactive worlds, but leave worlds explicitly stopped by the developer alone.
    if (worldStatus.status === 'stoppedByDeveloper') {
      console.debug(`World ${worldStatus._id} is stopped by developer, not restarting.`);
    }
    if (worldStatus.status === 'inactive') {
      console.log(`Restarting inactive world ${worldStatus._id}...`);
      await ctx.db.patch(worldStatus._id, { status: 'running' });
      await startEngine(ctx, worldStatus.worldId);
    }
  },
});

export const stopInactiveWorlds = internalMutation({
  handler: async (ctx) => {
    const cutoff = Date.now() - IDLE_WORLD_TIMEOUT;
    const worlds = await ctx.db.query('worldStatus').collect();
    for (const worldStatus of worlds) {
      if (cutoff < worldStatus.lastViewed || worldStatus.status !== 'running') {
        continue;
      }
      console.log(`Stopping inactive world ${worldStatus._id}`);
      await ctx.db.patch(worldStatus._id, { status: 'inactive' });
      await stopEngine(ctx, worldStatus.worldId);
    }
  },
});

export const restartDeadWorlds = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();

    // Restart an engine if it hasn't run for 2x its action duration.
    const engineTimeout = now - ENGINE_ACTION_DURATION * 2;
    const worlds = await ctx.db.query('worldStatus').collect();
    for (const worldStatus of worlds) {
      if (worldStatus.status !== 'running') {
        continue;
      }
      const engine = await ctx.db.get(worldStatus.engineId);
      if (!engine) {
        throw new Error(`Invalid engine ID: ${worldStatus.engineId}`);
      }
      if (engine.currentTime && engine.currentTime < engineTimeout) {
        console.warn(`Restarting dead engine ${engine._id}...`);
        await kickEngine(ctx, worldStatus.worldId);
      }
    }
  },
});

export const userStatus = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   return null;
    // }
    // return identity.tokenIdentifier;
    return DEFAULT_NAME;
  },
});

export const joinWorld = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   throw new ConvexError(`Not logged in`);
    // }
    // const name =
    //   identity.givenName || identity.nickname || (identity.email && identity.email.split('@')[0]);
    const name = DEFAULT_NAME;

    // if (!name) {
    //   throw new ConvexError(`Missing name on ${JSON.stringify(identity)}`);
    // }
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new ConvexError(`Invalid world ID: ${args.worldId}`);
    }
    // const { tokenIdentifier } = identity;
    return await insertInput(ctx, world._id, 'join', {
      name,
      character: characters[Math.floor(Math.random() * characters.length)].name,
      description: `${DEFAULT_NAME} is a human player`,
      // description: `${identity.givenName} is a human player`,
      tokenIdentifier: DEFAULT_NAME,
    });
  },
});

export const leaveWorld = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   throw new Error(`Not logged in`);
    // }
    // const { tokenIdentifier } = identity;
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    // const existingPlayer = world.players.find((p) => p.human === tokenIdentifier);
    const existingPlayer = world.players.find((p) => p.human === DEFAULT_NAME);
    if (!existingPlayer) {
      return;
    }
    await insertInput(ctx, world._id, 'leave', {
      playerId: existingPlayer.id,
    });
  },
});

export const sendWorldInput = mutation({
  args: {
    engineId: v.id('engines'),
    name: v.string(),
    args: v.any(),
  },
  handler: async (ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   throw new Error(`Not logged in`);
    // }
    return await engineInsertInput(ctx, args.engineId, args.name as any, args.args);
  },
});

export const worldState = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .unique();
    if (!worldStatus) {
      throw new Error(`Invalid world status ID: ${world._id}`);
    }
    const engine = await ctx.db.get(worldStatus.engineId);
    if (!engine) {
      throw new Error(`Invalid engine ID: ${worldStatus.engineId}`);
    }
    return { world, engine };
  },
});

export const gameDescriptions = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const worldMap = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!worldMap) {
      throw new Error(`No map for world: ${args.worldId}`);
    }
    
    // Deduplicate player descriptions by playerId
    const uniquePlayerDescriptions = [];
    const seenPlayerIds = new Set();
    for (const playerDesc of playerDescriptions) {
      if (!seenPlayerIds.has(playerDesc.playerId)) {
        seenPlayerIds.add(playerDesc.playerId);
        uniquePlayerDescriptions.push(playerDesc);
      }
    }
    
    return { worldMap, playerDescriptions: uniquePlayerDescriptions, agentDescriptions };
  },
});

// New query function specifically for player descriptions
export const getPlayerDescriptionsByWorld = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args): Promise<SerializedPlayerDescription[]> => {
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
      
    // Deduplicate player descriptions by playerId (keeping existing logic)
    const uniquePlayerDescriptions = [];
    const seenPlayerIds = new Set();
    for (const playerDesc of playerDescriptions) {
      if (!seenPlayerIds.has(playerDesc.playerId)) {
        seenPlayerIds.add(playerDesc.playerId);
        uniquePlayerDescriptions.push(playerDesc);
      }
    }
    
    return uniquePlayerDescriptions;
  },
});

export const previousConversation = query({
  args: {
    worldId: v.id('worlds'),
    playerId,
  },
  handler: async (ctx, args) => {
    // Walk the player's history in descending order, looking for a nonempty
    // conversation.
    const members = ctx.db
      .query('participatedTogether')
      .withIndex('playerHistory', (q) => q.eq('worldId', args.worldId).eq('player1', args.playerId))
      .order('desc');

    for await (const member of members) {
      const conversation = await ctx.db
        .query('archivedConversations')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('id', member.conversationId))
        .unique();
      if (!conversation) {
        throw new Error(`Invalid conversation ID: ${member.conversationId}`);
      }
      if (conversation.numMessages > 0) {
        return conversation;
      }
    }
    return null;
  },
});

export const paginatedPlayerDescriptions = query({
  args: {
    worldId: v.id('worlds'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // Ensure at least 10 items per page
    const numItems = Math.max(args.paginationOpts.numItems ?? 10, 10);
    
    // 获取所有的玩家描述
    const allPlayerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    // 手动过滤出ID为p:1到p:50的玩家
    const filteredPlayerDescriptions = allPlayerDescriptions.filter(desc => {
      // 解析playerId，格式应为"p:数字"
      const match = desc.playerId.match(/^p:(\d+)$/);
      if (!match) return false;
      
      const idNumber = parseInt(match[1], 10);
      // 只保留1到50之间的ID
      return idNumber >= 1 && idNumber <= 50;
    });
    
    // 手动排序
    filteredPlayerDescriptions.sort((a, b) => {
      const aNum = parseInt(a.playerId.substring(2), 10);
      const bNum = parseInt(b.playerId.substring(2), 10);
      return aNum - bNum;
    });
    
    // 手动分页
    const cursor = args.paginationOpts.cursor;
    const cursorIndex = cursor 
      ? filteredPlayerDescriptions.findIndex(desc => desc._id.toString() === cursor) 
      : -1;
    
    const startIndex = cursorIndex !== -1 ? cursorIndex + 1 : 0;
    const pageItems = filteredPlayerDescriptions.slice(startIndex, startIndex + numItems);
    
    // Get world data containing player information (including positions)
    const world = await ctx.db.get(args.worldId);
    
    if (!world) {
      throw new Error(`World not found: ${args.worldId}`);
    }
    
    // Add position information to each player description
    const enhancedPage = pageItems.map(playerDesc => {
      // Find the corresponding player from world data
      const player = world.players.find(p => p.id === playerDesc.playerId);
      
      // If player is found, add position information
      if (player) {
        return {
          ...playerDesc,
          position: player.position, // Add position
          facing: player.facing     // Add facing direction
        };
      }
      
      // If player not found (possibly offline), return original data
      return playerDesc;
    });
    
    // 确定是否有更多数据
    const hasMore = startIndex + numItems < filteredPlayerDescriptions.length;
    const lastId = pageItems.length > 0 ? pageItems[pageItems.length - 1]._id.toString() : null;
    
    // 返回手动分页的结果
    return {
      page: enhancedPage,
      isDone: !hasMore,
      continueCursor: hasMore ? lastId : null
    };
  },
});

// Get world by ID
export const getWorldById = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.worldId);
  },
});
