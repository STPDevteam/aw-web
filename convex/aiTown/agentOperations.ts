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
import { Point } from '../util/types';

/**
 * Simplified input batch processing class
 * Defined inline in agent operations module to avoid reference issues
 */
class SimpleInputBatcher {
  private lastProcessedTime: Map<string, number> = new Map();
  private inputFrequency: Map<string, {
    count: number,
    lastReset: number,
    threshold: number
  }> = new Map();
  
  // Minimum processing intervals - reduced to ensure actions flow consistently
  private minProcessIntervals = {
    high: 150,    // 150ms for high priority (conversations, critical actions)
    medium: 350,  // 350ms for medium priority (position updates, activities)
    low: 800      // 800ms for low priority (background activities)
  };
  
  // Input priority categorization
  private getInputPriority(name: string, args: any): 'high' | 'medium' | 'low' {
    if (name.includes('conversation') || name.includes('Message') || name.includes('Remember')) {
      return 'high';  // Conversation interactions are high priority
    } else if (name === 'finishDoSomething' && args.destination) {
      return 'medium'; // Movement updates are medium priority
    } else {
      return 'low';    // Other updates like activities are low priority
    }
  }
  
  // Check if an input is a critical agent action that should never be filtered
  private isCriticalAction(name: string, args: any): boolean {
    return name.includes('start') || 
           name.includes('leave') || 
           name.includes('Message') || 
           name.includes('conversation') || 
           name.includes('Remember') || 
           (name === 'finishDoSomething' && args.activity); // Activity setting is critical
  }
  
  async batchInput(ctx: ActionCtx, worldId: Id<'worlds'>, name: string, args: any): Promise<void> {
    const key = this.generateBatchKey(name, args);
    const now = Date.now();
    const priority = this.getInputPriority(name, args);
    const minInterval = this.minProcessIntervals[priority];
    
    // Critical actions bypass frequency checking
    const isCritical = this.isCriticalAction(name, args);
    
    // Check if this input is being sent too frequently
    const lastTime = this.lastProcessedTime.get(key) || 0;
    const timeSinceLastProcess = now - lastTime;
    
    // Track input frequency to detect spam patterns
    if (!this.inputFrequency.has(key)) {
      this.inputFrequency.set(key, { count: 0, lastReset: now, threshold: 5 });
    }
    
    const freqData = this.inputFrequency.get(key)!;
    
    // Reset counter if it's been over 5 seconds
    if (now - freqData.lastReset > 5000) {
      freqData.count = 0;
      freqData.lastReset = now;
    }
    
    freqData.count++;
    
    // Always allow critical actions to proceed
    if (!isCritical) {
      // Skip high-frequency inputs based on priority and frequency
      if (timeSinceLastProcess < minInterval) {
        // For frequently sent inputs, dynamically increase the threshold to reduce DB load
        if (freqData.count > freqData.threshold) {
          this.inputFrequency.set(key, {
            ...freqData,
            threshold: Math.min(freqData.threshold + 2, 20) // Gradually increase threshold up to 20
          });
          return; // Skip this input
        }
        
        // Skip redundant movements and non-critical updates at high frequency
        if ((name === 'finishDoSomething' && args.destination) || 
            (priority === 'low' && freqData.count > 2)) {
          // Occasionally let movement inputs through even during high frequency
          // Add randomness to give diversity to agent movements
          if (Math.random() > 0.2) { // 20% chance to let it through anyway
            return; // Skip this input
          }
        }
      }
    }
    
    // Record this processing time
    this.lastProcessedTime.set(key, now);
    
    // Only process inputs that passed all filters
    try {
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId,
        name,
        args
      });
    } catch (error) {
      console.error(`Error sending input ${name}:`, error);
      this.lastProcessedTime.delete(key);
    }
  }
  
  /**
   * Generate a batch key based on input name and arguments to group similar operations
   */
  private generateBatchKey(name: string, args: any): string {
    if (!args) return name;
    
    let key = name;
    
    // Include relevant IDs in the key to group by entity
    if (args.agentId) key += `:agent:${args.agentId}`;
    if (args.playerId) key += `:player:${args.playerId}`;
    if (args.conversationId) key += `:conversation:${args.conversationId}`;
    
    // For specific input types, add more specialized grouping
    if (name === 'finishDoSomething') {
      if (args.destination) {
        // Less specific grouping for movement to allow more diverse movement patterns
        const x = args.destination.x;
        const y = args.destination.y;
        if (x !== undefined && y !== undefined) {
          // Use 45-degree octants rather than exact directions
          const angle = Math.atan2(y, x);
          const octant = Math.floor((angle + Math.PI) / (Math.PI/4));
          key += `:move:oct${octant}`;
        } else {
          key += ':move';
        }
      }
      else if (args.activity) key += ':activity';
      else if (args.invitee) key += ':invite';
    }
    
    return key;
  }
}

// 创建批处理实例
const inputBatcher = new SimpleInputBatcher();

// Global throttling for all agent operations
const globalAgentThrottle = {
  lastOperationTimes: new Map<string, number>(),
  minimumInterval: 10000, // 10 seconds between any operations for the same agent
  movementBuffer: new Map<string, {
    lastMovement: number,
    pendingDestination: { x: number, y: number } | null
  }>(),
  clearOldEntries: (now: number) => {
    // Clean up entries older than 5 minutes
    for (const [key, time] of globalAgentThrottle.lastOperationTimes.entries()) {
      if (now - time > 300000) { // 5 minutes
        globalAgentThrottle.lastOperationTimes.delete(key);
      }
    }
    
    // Clean up movement buffer entries older than 5 minutes
    for (const [key, data] of globalAgentThrottle.movementBuffer.entries()) {
      if (now - data.lastMovement > 300000) { // 5 minutes
        globalAgentThrottle.movementBuffer.delete(key);
      }
    }
  }
};

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
      // Use a fixed small delay instead of random to prevent stuttering
      await sleep(200);
      
      // 添加备用机制
      try {
        // 首先尝试使用批处理系统
        await inputBatcher.batchInput(ctx, args.worldId, 'finishRememberConversation', {
          agentId: args.agentId,
          operationId: args.operationId,
        });
      } catch (error) {
        // 如果批处理失败，使用直接发送方式作为备份
        console.error("Batch input failed in agentRememberConversation, using direct send instead:", error);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishRememberConversation',
          args: {
            agentId: args.agentId,
            operationId: args.operationId,
          }
        });
      }
    } catch (error) {
      // Capture error, log it but don't affect main flow
      console.error(`Error in agentRememberConversation for ${args.conversationId}:`, error);
      // Still mark operation as completed so system can continue
      try {
        await inputBatcher.batchInput(ctx, args.worldId, 'finishRememberConversation', {
          agentId: args.agentId,
          operationId: args.operationId,
        });
      } catch (secondError) {
        // 备用方案
        console.error("Batch input failed during error recovery, using direct send:", secondError);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishRememberConversation',
          args: {
            agentId: args.agentId,
            operationId: args.operationId,
          }
        });
      }
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
    
    // Use the new direct mutation instead of the old approach - and run it in parallel
    const incrementPromise = ctx.runMutation(internal.aiTown.agentOperations.directIncrementInferences, {
      worldId: args.worldId,
      agentId: args.agentId
    }).catch(error => {
      console.error(`Failed to increment inferences for agent ${args.agentId}:`, error);
    });
    
    // Generate the message text
    const text = await completionFn(
      ctx,
      args.worldId,
      args.conversationId as GameId<'conversations'>,
      args.playerId as GameId<'players'>,
      args.otherPlayerId as GameId<'players'>,
    );

    // Wait for the increment to complete (should already be done, but just in case)
    await incrementPromise;
    
    // 添加备用机制
    const messageData = {
      conversationId: args.conversationId,
      agentId: args.agentId,
      playerId: args.playerId, 
      text,
      messageUuid: args.messageUuid,
      leaveConversation: args.type === 'leave',
      operationId: args.operationId,
      timestamp: Date.now()
    };
    
    try {
      // 首先尝试使用批处理系统
      await inputBatcher.batchInput(ctx, args.worldId, 'agentFinishSendingMessage', messageData);
    } catch (error) {
      // 如果批处理失败，使用直接发送方式作为备份
      console.error("Batch input failed in agentGenerateMessage, using direct send instead:", error);
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId: args.worldId,
        name: 'agentFinishSendingMessage',
        args: messageData
      });
    }
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
    const now = Date.now();
    
    // Clean up old throttle entries every 100 operations
    if (Math.random() < 0.01) {
      globalAgentThrottle.clearOldEntries(now);
    }
    
    // Check if this agent has operated recently
    const lastOperationTime = globalAgentThrottle.lastOperationTimes.get(agent.id);
    if (lastOperationTime && now - lastOperationTime < globalAgentThrottle.minimumInterval) {
      console.log(`🚫 EXTREME THROTTLING: Agent ${agent.id} operated ${now - lastOperationTime}ms ago. Must wait ${globalAgentThrottle.minimumInterval - (now - lastOperationTime)}ms more.`);
      return;
    }
    
    // Record operation time
    globalAgentThrottle.lastOperationTimes.set(agent.id, now);
    
    // Check logs to determine if there is an independent activity preference
    const logsPreferIndependentActivity = console.log.toString().includes(`Agent ${agent.id} prefers independent activity: true`);
    const shouldPreferIndependentActivity = logsPreferIndependentActivity || Math.random() < 0.7;

    const mapData = await ctx.runQuery(internal.aiTown.game.getFirstMap);
    if (!mapData) {
      console.error('Failed to fetch map data: no maps found');
      throw new Error('No maps found in database');
    }
    const map = new WorldMap(mapData as SerializedWorldMap);
    
    // Increase conversation cooldown time to prevent the AI from entering new conversations too quickly
    const EXTENDED_CONVERSATION_COOLDOWN = CONVERSATION_COOLDOWN * 3; // Three times the normal cooldown time
    
    // Check if just left a conversation or attempted an invite
    const justLeftConversation =
      agent.lastConversation && now < agent.lastConversation + EXTENDED_CONVERSATION_COOLDOWN;
    const recentlyAttemptedInvite =
      agent.lastInviteAttempt && now < agent.lastInviteAttempt + EXTENDED_CONVERSATION_COOLDOWN;
    const recentActivity = player.activity && now < player.activity.until + ACTIVITY_COOLDOWN;
    
    // Significantly lower the priority of conversation - only consider conversation under specific conditions
    // 1. Not in the conversation cooldown period
    // 2. Did not just attempt an invite
    // 3. Random number is less than 0.2 (only 20% chance)
    // 4. No preference for independent activity set
    const shouldTryConversation = 
      !justLeftConversation && 
      !recentlyAttemptedInvite && 
      Math.random() < 0.2 && 
      !shouldPreferIndependentActivity;
    
    // Use a uniform operation delay of 100ms to avoid jitter
    const ACTION_TIMING_DELAY = 100;
    
    // Prepare input data
    let inputData = null;
    
    // Attempt to find a conversation partner under these conditions
    if (shouldTryConversation) {
      const invitee = await ctx.runQuery(internal.aiTown.agent.findConversationCandidate, {
        now,
        worldId: args.worldId,
        player: args.player,
        otherFreePlayers: args.otherFreePlayers,
      });
      
      if (invitee) {
        console.log(`Agent ${agent.id} is initiating a conversation with ${invitee}`);
        inputData = {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: args.agent.id,
            invitee,
          },
        };
      }
    }
    
    // If there is no conversation to be had (the more likely scenario), decide on an activity or wander
    if (!inputData) {
      // Dramatically increase movement frequency - prefer movement over activities
      // 95% chance to choose wandering, 5% chance to choose an activity
      const activityOrWander = Math.random();
      
      if (activityOrWander < 0.95) { // Increased from 0.8 to 0.95 (95% chance of movement)
        // Check movement buffer for this agent
        let movementData = globalAgentThrottle.movementBuffer.get(agent.id);
        if (!movementData) {
          movementData = { lastMovement: 0, pendingDestination: null };
        }
        
        // Allow frequent movement with minimal cooldown
        const timeSinceLastMovement = now - movementData.lastMovement;
        
        // Even shorter cooldown (from 3000ms to 1000ms)
        if (timeSinceLastMovement < 1000) { // Reduced cooldown to 1 second
          console.log(`Agent ${agent.id} moved ${timeSinceLastMovement}ms ago, but forcing movement anyway`);
          // Continue with movement generation
        } 
        
        // Randomly wander to a new destination
        console.log(`Agent ${agent.id} is wandering to a new location after ${timeSinceLastMovement}ms`);
        const newDestination = wanderDestination(map);
        
        // Update the movement buffer
        globalAgentThrottle.movementBuffer.set(agent.id, {
          lastMovement: now,
          pendingDestination: newDestination
        });
        
        inputData = {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            destination: newDestination,
          },
        };
      } else {
        // Choose an activity for a very short duration
        const activityIndex = Math.floor((now / 1000) % ACTIVITIES.length);
        const activity = ACTIVITIES[activityIndex];
        console.log(`Agent ${agent.id} is doing activity: ${activity.description} (briefly)`);
        inputData = {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            activity: {
              description: activity.description,
              emoji: activity.emoji,
              until: Date.now() + 1000, // Even shorter activity duration (1 second)
            },
          },
        };
      }
    }
    
    // Operation delay
    await sleep(ACTION_TIMING_DELAY);
    
    // Only send if there is input data
    if (inputData) {
      try {
        // First attempt to use the batch input system
        await inputBatcher.batchInput(ctx, inputData.worldId, inputData.name, inputData.args);
      } catch (error) {
        // If batch input fails, use direct send as a backup
        console.error("Batch input failed, using direct send instead:", error);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: inputData.worldId,
          name: inputData.name,
          args: inputData.args
        });
      }
    }
  },
});

// Replace the wanderDestination function with a completely new implementation
// to generate truly random coordinates across the entire map
function wanderDestination(map: WorldMap): Point {
  const { width, height } = map;
  
  // Generate truly random coordinates across the entire map
  // Avoid using fixed values like 1 or width-2
  // Use the full range of the map with small margin (2 tiles) from the edges
  const margin = 2;
  
  // Random coordinates between margin and width/height minus margin
  const x = margin + Math.floor(Math.random() * (width - (2 * margin)));
  const y = margin + Math.floor(Math.random() * (height - (2 * margin)));
  
  // Add some variation to ensure we don't get same values repeatedly
  // Force occasional large jumps to make movement more interesting
  const shouldJump = Math.random() < 0.3; // 30% chance for a long jump
  
  if (shouldJump) {
    // Calculate a jump to a distant part of the map
    // Divide the map into quadrants and jump to a different quadrant
    const currentQuadrant = {
      x: x < width/2 ? 'left' : 'right',
      y: y < height/2 ? 'top' : 'bottom'
    };
    
    // Target the opposite quadrant
    const targetX = currentQuadrant.x === 'left' ? 
      (width/2) + Math.floor(Math.random() * (width/2 - margin)) : 
      margin + Math.floor(Math.random() * (width/2 - margin));
    
    const targetY = currentQuadrant.y === 'top' ? 
      (height/2) + Math.floor(Math.random() * (height/2 - margin)) : 
      margin + Math.floor(Math.random() * (height/2 - margin));
    
    console.log(`Generated long jump destination: (${targetX}, ${targetY})`);
    return { x: targetX, y: targetY };
  }
  
  console.log(`Generated random destination: (${x}, ${y})`);
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
