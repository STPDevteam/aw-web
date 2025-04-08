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
import { serializedAgent, SerializedAgent } from './agent';
import { ACTIVITIES } from '../constants';
import { api, internal } from '../_generated/api';
import { sleep } from '../util/sleep';
import { serializedPlayer } from './player';
import { Id } from '../_generated/dataModel';
import { Point } from '../util/types';
import { 
  generateDeterministicDestination, 
  updateAgentMovementTracker, 
  canAgentMove, 
  getNextSequenceNumber,
  cleanDestinationCache,
  getMovementStats,
  agentMovementTracker // Added export for tracking
} from './deterministicDestination';

// Lockout duration must match the lock in insertInput.ts
const AGENT_LOCK_DURATION = 10000; // 10 seconds

export const agentRememberConversation = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const agentDoc = await ctx.runQuery(internal.aiTown.agent.getAgent, { worldId: args.worldId, agentId: args.agentId as GameId<'agents'> });
    if (!agentDoc) {
      console.error(`Agent ${args.agentId} not found`);
      return;
    }
    if (agentDoc.inProgressOperation && 
        agentDoc.inProgressOperation.operationId !== args.operationId) {
      console.log(`Agent ${args.agentId} has another operation in progress, skipping rememberConversation.`);
      return;
    }
    
    try {
      await rememberConversation(
        ctx,
        args.worldId,
        args.agentId as GameId<'agents'>,
        args.playerId as GameId<'players'>,
        args.conversationId as GameId<'conversations'>,
      );
      // Use a fixed small delay
      await sleep(200);
      
      // Send completion input
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishRememberConversation',
          args: {
            agentId: args.agentId,
            operationId: args.operationId,
          }
        });
    } catch (error) {
      console.error("Error in agentRememberConversation:", error);
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
    messageUuid: v.string(),
    operationId: v.string(),
    type: v.union(v.literal('start'), v.literal('continue'), v.literal('leave')),
  },
  handler: async (ctx, args) => {
    const agentDoc = await ctx.runQuery(internal.aiTown.agent.getAgent, { worldId: args.worldId, agentId: args.agentId as GameId<'agents'> });
    if (!agentDoc) {
      console.error(`Agent ${args.agentId} not found`);
      return;
    }
    if (agentDoc.inProgressOperation && 
        agentDoc.inProgressOperation.operationId !== args.operationId) {
      console.log(`Agent ${args.agentId} has another operation in progress, skipping generateMessage.`);
      return;
    }
    
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
    const completion = await completionFn(
      ctx,
      args.worldId,
      args.conversationId as GameId<'conversations'>,
      args.playerId as GameId<'players'>,
      args.otherPlayerId as GameId<'players'>,
    );
    if (!completion) {
      console.log("Agent returned empty message, cancelling")
      // Failed to generate the message, cancel the operation
      // Send an input that the message finished sending
      const messageData = {
        agentId: args.agentId,
        conversationId: args.conversationId,
        timestamp: Date.now(),
        operationId: args.operationId,
        leaveConversation: args.type === 'leave',
      };
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId: args.worldId,
        name: 'agentFinishSendingMessage',
        args: messageData
      });
      return;
    }
    
    let text = completion; // Assume completion is string
    const leaveConversation = args.type === 'leave'; // Simplify, no function call check
    console.log("Agent message: " + text);
    
    // Send the message
    await ctx.runMutation(internal.aiTown.agent.agentSendMessage, {
      worldId: args.worldId,
      conversationId: args.conversationId,
          agentId: args.agentId,
      playerId: args.playerId,
      text,
      leaveConversation,
      messageUuid: args.messageUuid,
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
    const now = Date.now();
    
    const agentDoc = await ctx.runQuery(internal.aiTown.agent.getAgent, { worldId: args.worldId, agentId: agent.id as GameId<'agents'> });
    if (agentDoc?.inProgressOperation && 
        agentDoc.inProgressOperation.operationId !== args.operationId) {
      console.log(`Agent ${agent.id} already has operation ${agentDoc.inProgressOperation.operationId} in progress, skipping ${args.operationId}.`);
      return;
    }

    // Get map data for movement
    const mapData = await ctx.runQuery(internal.aiTown.game.getFirstMap);
    if (!mapData) {
      console.error('Failed to fetch map data: no maps found');
      throw new Error('No maps found in database');
    }
    const map = new WorldMap(mapData as SerializedWorldMap);
    
    // Prepare input data
    let inputData = null;
    
    // Simplified behavior: Always attempt to move unless a specific condition overrides it.
    // Let's remove the explicit shouldMove random check for now and make movement the default.

    // Generate a simple random destination
    const newDestination = simpleWanderDestination(map);
    
    // Default action is movement
    inputData = {
      worldId: args.worldId,
      name: 'finishDoSomething',
      args: {
        operationId: args.operationId,
        agentId: agent.id,
        destination: newDestination,
      },
    };
    
    console.log(`Agent ${agent.id} chose to move to (${newDestination.x}, ${newDestination.y})`);

    // NOTE: We removed the activity choice. If activities are needed later,
    // they would need a specific trigger condition, otherwise agents will always move.
    
    // Send the chosen action (which is always movement now)
    if (inputData) {
      try {
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: inputData.worldId,
          name: inputData.name,
          args: inputData.args
        });
      } catch (error) {
        console.error(`Error sending input for ${agent.id}:`, error);
      }
    }
  },
});

// Simplified random destination function - now ensures better distribution
function simpleWanderDestination(map: WorldMap): Point {
  const margin = 2;
  const maxAttempts = 10; // Try a few times to find a truly random spot
  
  for (let i = 0; i < maxAttempts; i++) {
    // Generate random coordinates within the map margins
    const x = margin + Math.floor(Math.random() * (map.width - 2 * margin));
    const y = margin + Math.floor(Math.random() * (map.height - 2 * margin));
    
    // Very basic check: avoid the exact center quadrant slightly more often
    // This isn't perfect distribution but avoids heavy clustering
    const isCenterRegion = 
      x > map.width * 0.4 && x < map.width * 0.6 &&
      y > map.height * 0.4 && y < map.height * 0.6;
      
    // Reroll 50% of the time if it lands in the center region
    if (isCenterRegion && Math.random() < 0.5) {
      continue; // Try again
    }
    
    return { x, y };
  }
  
  // Fallback if we couldn't find a non-center spot
  const x = margin + Math.floor(Math.random() * (map.width - 2 * margin));
  const y = margin + Math.floor(Math.random() * (map.height - 2 * margin));
  return { x, y };
}

// Revert incrementSenderInferences to original or remove if not used
// (Assuming the direct increment mutation in the original code was correct)
async function incrementSenderInferences(
  ctx: ActionCtx, 
  worldId: Id<'worlds'>, 
  agentId: string
): Promise<void> {
  // Revert to original logic or remove if unused
  console.log("incrementSenderInferences called - implementation needs review based on original code");
}

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

// Function to generate a deterministic destination based on agent ID and sequence number
// This prevents generating multiple different destinations in a small time window
function deterministicDestination(map: WorldMap, agentId: string, sequenceNumber: number): Point {
  const { width, height } = map;
  
  // Extract a numeric value from the agent ID to use as a seed
  const agentNumericId = parseInt(agentId.replace(/\D/g, ''), 10) || 0;
  
  // Create a deterministic seed from agent ID and sequence number
  const seed = agentNumericId * 10000 + sequenceNumber;
  
  // Use the seed to generate a pseudorandom position
  // This will be the same position if called multiple times with the same agent ID and sequence
  const margin = 2;
  
  // Use a simplistic pseudorandom number generator
  const rand = (max: number) => {
    // Simple LCG random number generator
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);
    // Update seed for next call
    const newVal = (a * seed + c) % m;
    // Return a value between 0 and max-1
    return Math.floor((newVal / m) * max);
  };
  
  // Generate x,y coordinates within map bounds
  const x = margin + rand(width - (2 * margin));
  const y = margin + rand(height - (2 * margin));
  
  // Log the deterministic values
  console.log(`Deterministic destination for agent ${agentId} with sequence ${sequenceNumber}: (${x}, ${y})`);
  
  return { x, y };
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
