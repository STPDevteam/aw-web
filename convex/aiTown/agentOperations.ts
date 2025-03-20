import { v } from 'convex/values';
import { internalAction } from '../_generated/server';
import { SerializedWorldMap, WorldMap, serializedWorldMap } from './worldMap';
import { rememberConversation } from '../agent/memory';
import { GameId, agentId, conversationId, playerId } from './ids';
import {
  continueConversationMessage,
  leaveConversationMessage,
  startConversationMessage,
} from '../agent/conversation';
import { assertNever } from '../util/assertNever';
import { serializedAgent } from './agent';
import { ACTIVITIES, ACTIVITY_COOLDOWN, CONVERSATION_COOLDOWN } from '../constants';
import { api, internal } from '../_generated/api';
import { sleep } from '../util/sleep';
import { serializedPlayer } from './player';

export const agentRememberConversation = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await rememberConversation(
        ctx,
        args.worldId,
        args.agentId as GameId<'agents'>,
        args.playerId as GameId<'players'>,
        args.conversationId as GameId<'conversations'>,
      );
      await sleep(Math.random() * 1000);
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId: args.worldId,
        name: 'finishRememberConversation',
        args: {
          agentId: args.agentId,
          operationId: args.operationId,
        },
      });
    } catch (error) {
      // Capture error, log it but don't affect main flow
      console.error(`Error in agentRememberConversation for ${args.conversationId}:`, error);
      // Still mark operation as completed so system can continue
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId: args.worldId,
        name: 'finishRememberConversation',
        args: {
          agentId: args.agentId,
          operationId: args.operationId,
        },
      });
    }
  },
});

export const agentGenerateMessage = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    otherPlayerId: playerId,
    operationId: v.string(),
    type: v.union(v.literal('start'), v.literal('continue'), v.literal('leave')),
    messageUuid: v.string(),
  },
  handler: async (ctx, args) => {
    let completionFn;
    switch (args.type) {
      case 'start':
        completionFn = startConversationMessage;
        break;
      case 'continue':
        completionFn = continueConversationMessage;
        break;
      case 'leave':
        completionFn = leaveConversationMessage;
        break;
      default:
        assertNever(args.type);
    }
    const text = await completionFn(
      ctx,
      args.worldId,
      args.conversationId as GameId<'conversations'>,
      args.playerId as GameId<'players'>,
      args.otherPlayerId as GameId<'players'>,
    );

    await ctx.runMutation(internal.aiTown.agent.agentSendMessage, {
      worldId: args.worldId,
      conversationId: args.conversationId,
      agentId: args.agentId,
      playerId: args.playerId,
      text,
      messageUuid: args.messageUuid,
      leaveConversation: args.type === 'leave',
      operationId: args.operationId,
    });
  },
});

export const agentDoSomething = internalAction({
  args: {
    worldId: v.id('worlds'),
    player: v.object(serializedPlayer),
    otherFreePlayers: v.array(v.object(serializedPlayer)),
    agent: v.object(serializedAgent),
    mapId: v.optional(v.id('maps')),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { player, agent } = args;


    const mapData = await ctx.runQuery(internal.aiTown.game.getFirstMap);
    if (!mapData) {
      console.error('Failed to fetch map data: no maps found');
      throw new Error('No maps found in database');
    }
    const map = new WorldMap(mapData as SerializedWorldMap);
    const now = Date.now();
    // Don't try to start a new conversation if we were just in one.
    const justLeftConversation =
      agent.lastConversation && now < agent.lastConversation + CONVERSATION_COOLDOWN;
    // Don't try again if we recently tried to find someone to invite.
    const recentlyAttemptedInvite =
      agent.lastInviteAttempt && now < agent.lastInviteAttempt + CONVERSATION_COOLDOWN;
    const recentActivity = player.activity && now < player.activity.until + ACTIVITY_COOLDOWN;
    
    // 只有25%的几率优先考虑对话（从75%降低到25%）
    const preferConversation = Math.random() < 0.25;
    
    // 如果优先考虑对话且没有冷却限制，尝试寻找对话伙伴
    if (preferConversation && !justLeftConversation && !recentlyAttemptedInvite) {
      const invitee = await ctx.runQuery(internal.aiTown.agent.findConversationCandidate, {
        now,
        worldId: args.worldId,
        player: args.player,
        otherFreePlayers: args.otherFreePlayers,
      });
      
      if (invitee) {
        await sleep(Math.random() * 1000); // 增加延迟从500ms到1000ms
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: args.agent.id,
            invitee,
          },
        });
        return;
      }
    }
    
    // 如果没找到对话伙伴或不优先对话，继续原有逻辑
    // Decide whether to do an activity or wander somewhere.
    if (!player.pathfinding) {
      // 增加活动的概率，减少随机漫步的可能性（优先选择活动）
      const shouldWander = (recentActivity || justLeftConversation) || Math.random() < 0.3; // 从0.6降低到0.3
      
      if (shouldWander) {
        await sleep(Math.random() * 1000); // 增加延迟
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            destination: wanderDestination(map),
          },
        });
        return;
      } else {
        // TODO: have LLM choose the activity & emoji
        const activity = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
        await sleep(Math.random() * 1000); // 增加延迟
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            activity: {
              description: activity.description,
              emoji: activity.emoji,
              until: Date.now() + activity.duration,
            },
          },
        });
        return;
      }
    }
    
    // 如果执行到这里，说明玩家正在移动中且没有选择对话
    // 检查是否可以邀请对话
    const invitee = 
      justLeftConversation || recentlyAttemptedInvite
        ? undefined
        : await ctx.runQuery(internal.aiTown.agent.findConversationCandidate, {
            now,
            worldId: args.worldId,
            player: args.player,
            otherFreePlayers: args.otherFreePlayers,
          });
    
    // TODO: We hit a lot of OCC errors on sending inputs in this file. It's
    // easy for them to get scheduled at the same time and line up in time.
    await sleep(Math.random() * 1000);
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishDoSomething',
      args: {
        operationId: args.operationId,
        agentId: args.agent.id,
        invitee,
      },
    });
  },
});

function wanderDestination(worldMap: WorldMap) {
  // More intelligently select target positions, ensuring there are no obstacles
  
  // The selected position needs to be farther from the map edges
  const margin = Math.floor(worldMap.width / 10);  // Margin to prevent selecting positions too close to the edge
  
  // Try selecting possible positions multiple times, avoid selecting obstacles
  for (let attempts = 0; attempts < 20; attempts++) {  // Increase the number of attempts to improve the probability of finding a suitable position
    const x = margin + Math.floor(Math.random() * (worldMap.width - 2 * margin));
    const y = margin + Math.floor(Math.random() * (worldMap.height - 2 * margin));
    
    // Check if the selected position has obstacles
    let hasObstacle = false;
    
    // Check all object layers
    for (let layerIndex = 0; layerIndex < worldMap.objectTiles.length; layerIndex++) {
      const layer = worldMap.objectTiles[layerIndex];
      // Check if there is a tile at this position, tile index >= 0 indicates an obstacle
      if (layer[x] && layer[x][y] >= 0) {
        hasObstacle = true;
        break;
      }
    }
    
    // If there are no obstacles, return this position
    if (!hasObstacle) {
      return { x, y };
    }
  }
  
  // If a suitable position can't be found after multiple attempts, use a simpler strategy:
  // Return a random point near the center of the map
  const centerX = Math.floor(worldMap.width / 2);
  const centerY = Math.floor(worldMap.height / 2);
  
  // Choose a point in a 5x5 area around the center
  const offsetX = Math.floor(Math.random() * 5) - 2;
  const offsetY = Math.floor(Math.random() * 5) - 2;
  
  // Ensure the point is within the map range
  const finalX = Math.max(0, Math.min(worldMap.width - 1, centerX + offsetX));
  const finalY = Math.max(0, Math.min(worldMap.height - 1, centerY + offsetY));
  
  return { x: finalX, y: finalY };
}
