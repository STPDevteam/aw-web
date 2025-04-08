import { ObjectType, v } from 'convex/values';
import { GameId, parseGameId } from './ids';
import { agentId, conversationId, playerId } from './ids';
import { serializedPlayer } from './player';
import { Game } from './game';
import {
  ACTION_TIMEOUT,
  AWKWARD_CONVERSATION_TIMEOUT,
  CONVERSATION_COOLDOWN,
  CONVERSATION_DISTANCE,
  INVITE_ACCEPT_PROBABILITY,
  INVITE_TIMEOUT,
  MAX_CONVERSATION_DURATION,
  MAX_CONVERSATION_MESSAGES,
  MESSAGE_COOLDOWN,
  MIDPOINT_THRESHOLD,
  PLAYER_CONVERSATION_COOLDOWN,
} from '../constants';
import { FunctionArgs } from 'convex/server';
import { MutationCtx, internalMutation, internalQuery } from '../_generated/server';
import { distance } from '../util/geometry';
import { internal } from '../_generated/api';
import { movePlayer, blocked } from './movement';
import { insertInput } from './insertInput';
import { Player } from './player';

// Define serializedAgent schema first before using it
export const serializedAgent = {
  id: agentId,
  playerId: playerId,
  toRemember: v.optional(conversationId),
  lastConversation: v.optional(v.number()),
  lastInviteAttempt: v.optional(v.number()),
  lastPathUpdate: v.optional(v.number()),
  inProgressOperation: v.optional(
    v.object({
      name: v.string(),
      operationId: v.string(),
      started: v.number(),
    }),
  ),
};
export type SerializedAgent = ObjectType<typeof serializedAgent>;

// Define AgentOperations type
type AgentOperations = typeof internal.aiTown.agentOperations;

export class Agent {
  id: GameId<'agents'>;
  playerId: GameId<'players'>;
  toRemember?: GameId<'conversations'>;
  lastConversation?: number;
  lastInviteAttempt?: number;
  lastPathUpdate?: number;
  inProgressOperation?: {
    name: string;
    operationId: string;
    started: number;
  };

  constructor(serialized: SerializedAgent) {
    const { id, lastConversation, lastInviteAttempt, lastPathUpdate, inProgressOperation } = serialized;
    const playerId = parseGameId('players', serialized.playerId);
    this.id = parseGameId('agents', id);
    this.playerId = playerId;
    this.toRemember =
      serialized.toRemember !== undefined
        ? parseGameId('conversations', serialized.toRemember)
        : undefined;
    this.lastConversation = lastConversation;
    this.lastInviteAttempt = lastInviteAttempt;
    this.lastPathUpdate = lastPathUpdate;
    this.inProgressOperation = inProgressOperation;
  }

  tick(game: Game, now: number): void {
    const player = game.world.players.get(this.playerId);
    if (!player) {
      throw new Error(`Invalid player ID ${this.playerId}`);
    }
    
    // --- Simplified Agent Tick Logic --- 

    // 1. Check if agent has an operation in progress
    if (this.inProgressOperation) {
      if (now < this.inProgressOperation.started + ACTION_TIMEOUT) {
        // Wait on the operation to finish.
        return;
      }
      // Operation timed out, clear it and decide new action
      console.log(`Timing out ${JSON.stringify(this.inProgressOperation)}`);
      delete this.inProgressOperation;
    }

    // 2. Check if agent is in a conversation
    const conversation = game.world.playerConversation(player);
    if (conversation) {
      // If in conversation, handle conversation logic (accept invite, walk over, participate, leave)
      // This part remains largely the same as it handles the conversation state machine
      this.handleConversationTick(game, now, player, conversation);
      return; // Agent is busy with conversation, no other actions needed
    }

    // 3. Check if agent is currently moving (pathfinding)
    if (player.pathfinding) {
      // Agent is moving, let them continue. No new action needed.
      // Pathfinding completion and new destination requests are handled by agentDoSomething when it's triggered next time.
      return; 
    }

    // 4. Check if agent is doing a non-interruptible activity (optional)
    // If we want activities, we need a way to decide if they *block* new actions.
    // For now, we assume activities don't block triggering agentDoSomething.
    // let doingActivity = player.activity && player.activity.until > now;
    // if (doingActivity) {
    //   return; // Let activity finish
    // }

    // 5. Check if agent needs to remember a conversation
    if (this.toRemember) {
      console.log(`Agent ${this.id} remembering conversation ${this.toRemember}`);
      this.startOperation(game, now, 'agentRememberConversation', {
        worldId: game.worldId,
        playerId: this.playerId,
        agentId: this.id,
        conversationId: this.toRemember,
      });
      delete this.toRemember;
      return; 
    }

    // 6. If agent is idle (no operation, not in conversation, not moving), trigger agentDoSomething
    console.log(`Agent ${this.id} is idle, triggering agentDoSomething.`);
    
    // --- Calculate otherFreePlayers --- 
    const otherPlayers = [...game.world.players.values()];
    const otherFreePlayers = otherPlayers.filter(otherPlayer => {
      // Exclude self
      if (otherPlayer.id === player.id) {
        return false;
      }
      // Exclude players currently in a conversation
      if (game.world.playerConversation(otherPlayer)) {
        return false;
      }
      // Exclude human players (optional, but common)
      if (otherPlayer.human) {
         return false;
      }
      // Optional: Exclude players recently conversed with (requires checking history/memory)
      // const recentlyTalked = checkRecentConversation(game, player.id, otherPlayer.id);
      // if (recentlyTalked) return false;
      
      return true; // Include this player
    }).map(p => p.serialize()); // Serialize the players for the action args
    // --- End Calculate --- 

    // Corrected parameters for agentDoSomething
    const operationArgs = {
      worldId: game.worldId,
      player: player.serialize(),
      otherFreePlayers: otherFreePlayers, // Pass the calculated list
      agent: this.serialize(),
      mapId: game.worldMap.id!,
    };
    this.startOperation(game, now, 'agentDoSomething', operationArgs);
  }

  // Add a helper method to handle conversation state logic cleanly
  handleConversationTick(game: Game, now: number, player: Player, conversation: any): void {
    const member = conversation?.participants.get(player.id);
    if (!member) return; // Should not happen if conversation exists
    
    const [otherPlayerId, otherMember] = [...conversation.participants.entries()].find(
      ([id]) => id !== player.id,
    )!;
    const otherPlayer = game.world.players.get(otherPlayerId)!;

    // Handle different conversation states
    switch(member.status.kind) {
      case 'invited':
        this.handleInvitedState(game, now, player, conversation, otherPlayer);
        break;
      case 'walkingOver':
        this.handleWalkingOverState(game, now, player, conversation, otherPlayer, member);
        break;
      case 'participating':
        this.handleParticipatingState(game, now, player, conversation, otherPlayer, member);
        break;
    }
  }

  // Extracted helper methods for conversation states
  handleInvitedState(game: Game, now: number, player: Player, conversation: any, otherPlayer: Player): void {
    // (Keep the existing logic for accepting/rejecting invites)
    const agentDescription = game.agentDescriptions.get(this.id);
    const energyDepleted = agentDescription && agentDescription.energy <= 0;
    
    if (energyDepleted) {
      console.log(`Agent ${player.id} rejecting invite from ${otherPlayer.id} due to depleted energy`);
      conversation.rejectInvite(game, now, player);
      return;
    }
    
    if (otherPlayer.human || Math.random() < INVITE_ACCEPT_PROBABILITY) {
      console.log(`Agent ${player.id} accepting invite from ${otherPlayer.id}`);
      conversation.acceptInvite(game, player);
      if (player.pathfinding) {
        delete player.pathfinding;
      }
    } else {
      console.log(`Agent ${player.id} rejecting invite from ${otherPlayer.id}`);
      conversation.rejectInvite(game, now, player);
    }
  }

  handleWalkingOverState(game: Game, now: number, player: Player, conversation: any, otherPlayer: Player, member: any): void {
    // (Keep the existing logic for walking over, checking timeout, distance)
    const agentDescription = game.agentDescriptions.get(this.id);
    const energyDepleted = agentDescription && agentDescription.energy <= 0;
    
    if (energyDepleted) {
      console.log(`Agent ${player.id} giving up on invite to ${otherPlayer.id} due to depleted energy`);
      conversation.leave(game, now, player);
      return;
    }
    
    if (member.invited + INVITE_TIMEOUT < now) {
      console.log(`Giving up on invite to ${otherPlayer.id}`);
      conversation.leave(game, now, player);
      return;
    }

    const playerDistance = distance(player.position, otherPlayer.position);
    if (playerDistance < CONVERSATION_DISTANCE) {
      return; // Close enough, wait
    }

    if (!player.pathfinding) {
      let destination;
      if (playerDistance < MIDPOINT_THRESHOLD) {
        destination = { x: Math.floor(otherPlayer.position.x), y: Math.floor(otherPlayer.position.y) };
      } else {
        destination = { x: Math.floor((player.position.x + otherPlayer.position.x) / 2), y: Math.floor((player.position.y + otherPlayer.position.y) / 2) };
      }
      console.log(`Agent ${player.id} walking towards ${otherPlayer.id}...`, destination);
      const destinationBlocked = blocked(game, now, destination, player.id);
      if (destinationBlocked) {
        console.warn(`Agent ${player.id} destination is blocked: ${destinationBlocked}`, destination);
        // Find available positions nearby
        const alternatives = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue; // Skip the original position
            
            const alt = {
              x: Math.floor(destination.x) + dx,
              y: Math.floor(destination.y) + dy
            };
            
            if (!blocked(game, now, alt, player.id)) {
              alternatives.push(alt);
            }
          }
        }
        
        if (alternatives.length > 0) {
          // Choose the closest available position to the target
          alternatives.sort((a, b) => 
            distance(a, otherPlayer.position) - distance(b, otherPlayer.position)
          );
          destination = alternatives[0];
          console.log(`Agent ${player.id} using alternative destination`, destination);
        }
      }
      movePlayer(game, now, player, destination);
    }
  }

  handleParticipatingState(game: Game, now: number, player: Player, conversation: any, otherPlayer: Player, member: any): void {
    // (Keep the existing logic for generating messages, checking timeouts, etc.)
    const started = member.status.started;
    const agentDescription = game.agentDescriptions.get(this.id);
    const energyDepleted = agentDescription && agentDescription.energy <= 0;

    if (energyDepleted) {
      // Leave conversation due to energy
      this.triggerAgentMessage(game, now, player, conversation, otherPlayer, 'leave');
      return;
    }

    if (conversation.isTyping && conversation.isTyping.playerId !== player.id) {
      return; // Wait for other player
    }

    if (!conversation.lastMessage) {
      const isInitiator = conversation.creator === player.id;
      const awkwardDeadline = started + AWKWARD_CONVERSATION_TIMEOUT;
      if (isInitiator || awkwardDeadline < now) {
        // Send first message
        this.triggerAgentMessage(game, now, player, conversation, otherPlayer, 'start');
        return;
      }
    } else {
      const tooLongDeadline = started + MAX_CONVERSATION_DURATION;
      if (tooLongDeadline < now || conversation.numMessages > MAX_CONVERSATION_MESSAGES) {
        // Leave due to duration/length
        this.triggerAgentMessage(game, now, player, conversation, otherPlayer, 'leave');
        return;
      }

      if (conversation.lastMessage.author === player.id) {
        const awkwardDeadline = conversation.lastMessage.timestamp + AWKWARD_CONVERSATION_TIMEOUT;
        if (now < awkwardDeadline) {
          return; // Wait for reply
        }
      }

      const messageCooldown = conversation.lastMessage.timestamp + MESSAGE_COOLDOWN;
      if (now < messageCooldown) {
        return; // Wait for cooldown
      }
      
      // Continue conversation
      this.triggerAgentMessage(game, now, player, conversation, otherPlayer, 'continue');
    }
  }

  // Helper to start agentGenerateMessage operation
  triggerAgentMessage(game: Game, now: number, player: Player, conversation: any, otherPlayer: Player, type: 'start' | 'continue' | 'leave'): void {
    console.log(`${player.id} ${type}ing conversation with ${otherPlayer.id}.`);
    const messageUuid = crypto.randomUUID();
    conversation.setIsTyping(now, player, messageUuid);
    this.startOperation(game, now, 'agentGenerateMessage', {
      worldId: game.worldId,
      playerId: player.id,
      agentId: this.id,
      conversationId: conversation.id,
      otherPlayerId: otherPlayer.id,
      messageUuid,
      type,
    });
  }

  startOperation<Name extends keyof AgentOperations>(
    game: Game,
    now: number,
    name: Name,
    args: Omit<FunctionArgs<AgentOperations[Name]>, 'operationId'>,
  ): void {
    if (this.inProgressOperation) {
      throw new Error(
        `Agent ${this.id} already has an operation: ${JSON.stringify(this.inProgressOperation)}`,
      );
    }
    const operationId = game.allocId('operations');
    console.log(`Agent ${this.id} starting operation ${name} (${operationId})`);
    game.scheduleOperation(name, { operationId, ...args } as any);
    this.inProgressOperation = {
      name,
      operationId,
      started: now,
    };
  }

  serialize(): SerializedAgent {
    return {
      id: this.id,
      playerId: this.playerId,
      toRemember: this.toRemember,
      lastConversation: this.lastConversation,
      lastInviteAttempt: this.lastInviteAttempt,
      lastPathUpdate: this.lastPathUpdate,
      inProgressOperation: this.inProgressOperation,
    };
  }
}

export async function runAgentOperation(ctx: MutationCtx, operation: string, args: any) {
  let reference;
  switch (operation) {
    case 'agentRememberConversation':
      reference = internal.aiTown.agentOperations.agentRememberConversation;
      break;
    case 'agentGenerateMessage':
      reference = internal.aiTown.agentOperations.agentGenerateMessage;
      break;
    case 'agentDoSomething':
      reference = internal.aiTown.agentOperations.agentDoSomething;
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  await ctx.scheduler.runAfter(0, reference, args);
}

export const agentSendMessage = internalMutation({
  args: {
    worldId: v.id('worlds'),
    conversationId,
    agentId,
    playerId,
    text: v.string(),
    messageUuid: v.string(),
    leaveConversation: v.boolean(),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      author: args.playerId,
      text: args.text,
      messageUuid: args.messageUuid,
      worldId: args.worldId,
    });
    await insertInput(ctx, args.worldId, 'agentFinishSendingMessage', {
      conversationId: args.conversationId,
      agentId: args.agentId,
      timestamp: Date.now(),
      leaveConversation: args.leaveConversation,
      operationId: args.operationId,
    });
  },
});

export const findConversationCandidate = internalQuery({
  args: {
    now: v.number(),
    worldId: v.id('worlds'),
    player: v.object(serializedPlayer),
    otherFreePlayers: v.array(v.object(serializedPlayer)),
  },
  handler: async (ctx, { now, worldId, player, otherFreePlayers }) => {
    const { position } = player;
    const candidates = [];
    
    // 降低找到对话候选人的概率，增大距离限制
    const MAX_CONVERSATION_DISTANCE = 10.0; // 限制最大距离
    
    // 随机性：有20%的概率直接返回空，即使有合适的候选人
    if (Math.random() < 0.2) {
      return undefined;
    }

    for (const otherPlayer of otherFreePlayers) {
      // 检查最近一次与该玩家的对话
      const lastMember = await ctx.db
        .query('participatedTogether')
        .withIndex('edge', (q) =>
          q.eq('worldId', worldId).eq('player1', player.id).eq('player2', otherPlayer.id),
        )
        .order('desc')
        .first();
      
      // 如果最近有对话记录，检查是否在冷却期内
      if (lastMember) {
        // 增加冷却时间，从原来的标准冷却时间增加到2倍
        if (now < lastMember.ended + PLAYER_CONVERSATION_COOLDOWN * 2) {
          continue; // 跳过该候选人
        }
      }
      
      // 计算距离
      const dist = distance(otherPlayer.position, position);
      
      // 只考虑在最大距离范围内的玩家
      if (dist <= MAX_CONVERSATION_DISTANCE) {
        candidates.push({ 
          id: otherPlayer.id, 
          position: otherPlayer.position,
          distance: dist
        });
      }
    }

    if (candidates.length === 0) {
      return undefined;
    }

    // 按距离排序
    candidates.sort((a, b) => a.distance - b.distance);
    
    // 只选择最接近的候选人
    return candidates[0]?.id;
  },
});

// Query the world and find the agent within it

export const getAgent = internalQuery({
  args: {
    worldId: v.id('worlds'), // Assuming we can pass worldId here
    agentId: agentId 
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world || !world.agents) {
      return null;
    }
    const agent = world.agents.find((a) => a.id === args.agentId);
    return agent || null;
  }
});
