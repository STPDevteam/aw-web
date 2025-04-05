import { v } from 'convex/values';
import { internalAction, ActionCtx, internalMutation } from '../_generated/server';
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
import { Id } from '../_generated/dataModel';

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

// Add this new mutation to directly update the inferences count
export const directIncrementInferences = internalMutation({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Get agent description directly from database
      const agentDesc = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', args.agentId))
        .unique();
      
      if (!agentDesc) {
        console.warn(`Agent description not found for ${args.agentId}`);
        return { success: false, error: 'Agent description not found' };
      }
      
      // Increment inferences count
      const currentInferences = agentDesc.inferences || 0;
      const newInferences = currentInferences + 1;
      
      // Calculate new energy value (decrease by 1 for each message)
      const currentEnergy = agentDesc.energy ?? 100; // Default to 100 if undefined
      const newEnergy = Math.max(0, currentEnergy - 1); // Ensure energy doesn't go below 0
      
      // Update both inferences and energy directly in database
      await ctx.db.patch(agentDesc._id, { 
        inferences: newInferences,
        energy: newEnergy
      });
      
      console.log(`[DIRECT UPDATE] Agent ${args.agentId} inferences increased from ${currentInferences} to ${newInferences}, energy decreased from ${currentEnergy} to ${newEnergy}`);
      
      return { 
        success: true, 
        newInferences,
        newEnergy 
      };
    } catch (error) {
      console.error(`Error updating agent ${args.agentId}:`, error);
      return { success: false, error: String(error) };
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
    
    // Use the new direct mutation instead of the old approach
    try {
      await ctx.runMutation(internal.aiTown.agentOperations.directIncrementInferences, {
        worldId: args.worldId,
        agentId: args.agentId
      });
      console.log(`Used direct mutation to increment inferences for agent ${args.agentId}`);
    } catch (error) {
      console.error(`Failed to increment inferences for agent ${args.agentId}:`, error);
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

/**
 * Increments the inferences count for the agent sending a message
 * This is called each time an agent generates a message
 */
async function incrementSenderInferences(
  ctx: ActionCtx, 
  worldId: Id<'worlds'>, 
  agentId: string
): Promise<void> {
  try {
    // Get all agent descriptions
    const agentDescriptions = await ctx.runQuery(internal.aiTown.game.getAgentDescriptions, {
      worldId
    });
    
    // Find the agent description
    const agentDesc = agentDescriptions.find(a => a.agentId === agentId);
    
    if (agentDesc) {
      const newInferences = (agentDesc.inferences || 0) + 1;
      
      // Update the agent's inferences count
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId,
        name: 'updateAgentInferences',
        args: {
          agentId,
          inferences: newInferences
        }
      });
      
      console.log(`Agent ${agentId} inferences increased to ${newInferences}`);
    }
  } catch (error) {
    console.error("Error incrementing inferences:", error);
  }
}

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
    
    // Decide whether to do a conversation - no longer using random probability, based on time instead
    // If there is enough time passed (cool down is over), prioritize conversation
    const preferConversation = !justLeftConversation && !recentlyAttemptedInvite;
    
    // If we prioritize conversation and there is no cool down limit, try to find a conversation partner
    if (preferConversation) {
      const invitee = await ctx.runQuery(internal.aiTown.agent.findConversationCandidate, {
        now,
        worldId: args.worldId,
        player: args.player,
        otherFreePlayers: args.otherFreePlayers,
      });
      
      if (invitee) {
        await sleep(500); // Use fixed delay
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
    
    // If we don't find a conversation partner or don't prioritize conversation, continue with the original logic
    // Decide whether to do an activity or wander somewhere.
    if (!player.pathfinding) {
      // When we can't do a conversation, alternate between activity and wandering
      const shouldWander = player.activity && player.activity.until < now;
      
      if (shouldWander) {
        await sleep(500); // Use fixed delay
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
        // Select activity, not using random number
        const activityIndex = Math.floor((now / 1000) % ACTIVITIES.length);
        const activity = ACTIVITIES[activityIndex];
        await sleep(500); // Use fixed delay
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
    
    // If we get here, the player is moving and there is no conversation choice
    // Check if we can invite a conversation
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
    await sleep(500);
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishDoSomething',
      args: {
        operationId: args.operationId,
        agentId: agent.id,
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

// Function to reset all agent energy levels to 100
export const resetAllAgentEnergy = internalMutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    try {
      // Get all agent descriptions for the given world
      const agentDescriptions = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
        .collect();
      
      // Count of updated agents
      let updatedCount = 0;
      
      // Update each agent's energy to 100
      for (const agentDesc of agentDescriptions) {
        await ctx.db.patch(agentDesc._id, { energy: 100 });
        updatedCount++;
      }
      
      console.log(`[ENERGY RESET] Successfully reset energy to 100 for ${updatedCount} agents`);
      return { 
        success: true, 
        message: `Energy reset to 100 for ${updatedCount} agents`,
        updatedCount 
      };
    } catch (error) {
      console.error('Error resetting agent energy:', error);
      return { 
        success: false, 
        error: String(error) 
      };
    }
  },
});

// Update agent description for wallet binding
export const updateAgentDescriptionForWallet = internalMutation({
  args: {
    worldId: v.id('worlds'),
    agentId: v.string(),
    walletAddress: v.string(),
    identity: v.string(),
    plan: v.string(),
    avatarUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { worldId, agentId, walletAddress, identity, plan, avatarUrl } = args;
    
    // Find the agent description
    const agentDesc = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('agentId', agentId))
      .unique();
      
    if (!agentDesc) {
      throw new Error(`Agent description not found for agentId: ${agentId}`);
    }
    
    // Update the agent description
    await ctx.db.patch(agentDesc._id, {
      walletAddress,
      identity,
      plan,
      avatarUrl
    });
    
    return { success: true };
  },
});

// Update player description
export const updatePlayerDescription = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const { worldId, playerId, name, description } = args;
    
    // Find the player description
    const playerDesc = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('playerId', playerId))
      .unique();
      
    if (!playerDesc) {
      throw new Error(`Player description not found for playerId: ${playerId}`);
    }
    
    // Update the player description
    await ctx.db.patch(playerDesc._id, {
      name,
      description
    });
    
    return { success: true };
  },
});
