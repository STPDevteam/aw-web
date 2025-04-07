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
    if (this.inProgressOperation) {
      if (now < this.inProgressOperation.started + ACTION_TIMEOUT) {
        // Wait on the operation to finish.
        return;
      }
      console.log(`Timing out ${JSON.stringify(this.inProgressOperation)}`);
      delete this.inProgressOperation;
    }
    
    // Check if agent energy is 0
    const agentDescription = game.agentDescriptions.get(this.id);
    const energyDepleted = agentDescription && agentDescription.energy <= 0;
    
    const conversation = game.world.playerConversation(player);
    const member = conversation?.participants.get(player.id);

    // Reduce conversation initiation frequency - Increase cooldown duration
    // Add at least 30 seconds additional cooldown, even if agentDoSomething attempts to start a new conversation
    const recentlyAttemptedInvite =
      this.lastInviteAttempt && now < this.lastInviteAttempt + (CONVERSATION_COOLDOWN + 30000);
    
    // Lower the probability of accepting conversation invites - introduce randomness
    // For agents who ended a conversation within the last 120 seconds, there is a 70% chance to refuse a new invitation
    if (this.lastConversation && now < this.lastConversation + 120000) {
      // Agents who ended a conversation within the last 120 seconds have a 70% chance to refuse a new invitation
      if (Math.random() < 0.7) {
        if (conversation && member && member.status.kind === 'invited') {
          console.log(`Agent ${player.id} rejecting invite due to recent conversation`);
          conversation.rejectInvite(game, now, player);
          return;
        }
      }
    }

    let doingActivity = player.activity && player.activity.until > now;
    
    // Increase the likelihood of completing an activity
    // Reduce the probability of interrupting the current activity to 5%
    if (doingActivity && (conversation || player.pathfinding)) {
      if (Math.random() < 0.05) {  // Reduced from 0.1 to 0.05
        player.activity!.until = now;
        doingActivity = false;
      }
    }
    
    // Further decrease the likelihood of actively seeking conversation opportunities
    // Reduce the random interruption probability from 5% further down to 2%
    if (doingActivity && !conversation && !player.pathfinding && Math.random() < 0.02) {  // Reduced from 0.05 to 0.02
      player.activity!.until = now;
      doingActivity = false;
    }

    // If not in a conversation and not engaged in an activity, then perform alternative actions
    // Significantly increase the chance of choosing non-conversational activities
    if (!conversation && !doingActivity && (!player.pathfinding || !recentlyAttemptedInvite) && !energyDepleted) {
      // Increase randomness, making the agent more inclined to engage in independent activities rather than conversations
      const shouldDoIndependentActivity = Math.random() < 0.7;  // 70% chance to choose independent activity
      
      // Create operation parameters, removing unsupported properties
      const operationArgs = {
        worldId: game.worldId,
        player: player.serialize(),
        otherFreePlayers: [...game.world.players.values()]
          .filter((p) => p.id !== player.id)
          .filter(
            (p) => ![...game.world.conversations.values()].find((c) => c.participants.has(p.id)),
          )
          .map((p) => p.serialize()),
        agent: this.serialize(),
        mapId: game.worldMap.id!,
      };

      // Log the independent activity preference for AI usage
      console.log(`Agent ${this.id} prefers independent activity: ${shouldDoIndependentActivity}`);
      
      this.startOperation(game, now, 'agentDoSomething', operationArgs);
      return;
    }
    
    // Check to see if we have a conversation we need to remember.
    if (this.toRemember) {
      // Fire off the action to remember the conversation.
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
    
    if (conversation && member) {
      const [otherPlayerId, otherMember] = [...conversation.participants.entries()].find(
        ([id]) => id !== player.id,
      )!;
      const otherPlayer = game.world.players.get(otherPlayerId)!;
      
      if (member.status.kind === 'invited') {
        // get agent energy
        const agentDescription = game.agentDescriptions.get(this.id);
        const energyDepleted = agentDescription && agentDescription.energy <= 0;
        
        // if energy is 0, reject conversation invitation
        if (energyDepleted) {
          console.log(`Agent ${player.id} rejecting invite from ${otherPlayer.id} due to depleted energy`);
          conversation.rejectInvite(game, now, player);
          return;
        }
        
        // Accept a conversation with another agent with some probability and with
        // a human unconditionally.
        if (otherPlayer.human || Math.random() < INVITE_ACCEPT_PROBABILITY) {
          console.log(`Agent ${player.id} accepting invite from ${otherPlayer.id}`);
          
          conversation.acceptInvite(game, player);
          // Stop moving so we can start walking towards the other player.
          if (player.pathfinding) {
            delete player.pathfinding;
          }
        } else {
          console.log(`Agent ${player.id} rejecting invite from ${otherPlayer.id}`);
          conversation.rejectInvite(game, now, player);
        }
        return;
      }
      
      if (member.status.kind === 'walkingOver') {
        // Check if agent has run out of energy while walking to conversation
        const agentDescription = game.agentDescriptions.get(this.id);
        const energyDepleted = agentDescription && agentDescription.energy <= 0;
        
        // If energy is depleted, give up on the conversation
        if (energyDepleted) {
          console.log(`Agent ${player.id} giving up on invite to ${otherPlayer.id} due to depleted energy`);
          conversation.leave(game, now, player);
          return;
        }
        
        // Leave a conversation if we've been waiting for too long.
        if (member.invited + INVITE_TIMEOUT < now) {
          console.log(`Giving up on invite to ${otherPlayer.id}`);
          conversation.leave(game, now, player);
          return;
        }

        // Don't keep moving around if we're near enough.
        const playerDistance = distance(player.position, otherPlayer.position);
        if (playerDistance < CONVERSATION_DISTANCE) {
          return;
        }

        // Keep moving towards the other player.
        // If we're close enough to the player, just walk to them directly.
        if (!player.pathfinding) {
          let destination;
          if (playerDistance < MIDPOINT_THRESHOLD) {
            destination = {
              x: Math.floor(otherPlayer.position.x),
              y: Math.floor(otherPlayer.position.y),
            };
          } else {
            destination = {
              x: Math.floor((player.position.x + otherPlayer.position.x) / 2),
              y: Math.floor((player.position.y + otherPlayer.position.y) / 2),
            };
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
        return;
      }
      
      if (member.status.kind === 'participating') {
        const started = member.status.started;
        
        // Check if agent has run out of energy during conversation
        const agentDescription = game.agentDescriptions.get(this.id);
        const energyDepleted = agentDescription && agentDescription.energy <= 0;
        
        // If energy is depleted, leave the conversation
        if (energyDepleted) {
          console.log(`${player.id} leaving conversation with ${otherPlayer.id} due to depleted energy.`);
          const messageUuid = crypto.randomUUID();
          
          conversation.setIsTyping(now, player, messageUuid);
          
          this.startOperation(game, now, 'agentGenerateMessage', {
            worldId: game.worldId,
            playerId: player.id,
            agentId: this.id,
            conversationId: conversation.id,
            otherPlayerId: otherPlayer.id,
            messageUuid,
            type: 'leave',
          });
          return;
        }
        
        if (conversation.isTyping && conversation.isTyping.playerId !== player.id) {
          // Wait for the other player to finish typing.
          return;
        }
        if (!conversation.lastMessage) {
          const isInitiator = conversation.creator === player.id;
          const awkwardDeadline = started + AWKWARD_CONVERSATION_TIMEOUT;
          // Send the first message if we're the initiator or if we've been waiting for too long.
          if (isInitiator || awkwardDeadline < now) {
            // Grab the lock on the conversation and send a "start" message.
            console.log(`${player.id} initiating conversation with ${otherPlayer.id}.`);
            const messageUuid = crypto.randomUUID();
            
            conversation.setIsTyping(now, player, messageUuid);
            
            this.startOperation(game, now, 'agentGenerateMessage', {
              worldId: game.worldId,
              playerId: player.id,
              agentId: this.id,
              conversationId: conversation.id,
              otherPlayerId: otherPlayer.id,
              messageUuid,
              type: 'start',
            });
            return;
          } else {
            // Wait on the other player to say something up to the awkward deadline.
            return;
          }
        }
        // See if the conversation has been going on too long and decide to leave.
        const tooLongDeadline = started + MAX_CONVERSATION_DURATION;
        if (tooLongDeadline < now || conversation.numMessages > MAX_CONVERSATION_MESSAGES) {
          console.log(`${player.id} leaving conversation with ${otherPlayer.id}.`);
          const messageUuid = crypto.randomUUID();
          
          conversation.setIsTyping(now, player, messageUuid);
          
          this.startOperation(game, now, 'agentGenerateMessage', {
            worldId: game.worldId,
            playerId: player.id,
            agentId: this.id,
            conversationId: conversation.id,
            otherPlayerId: otherPlayer.id,
            messageUuid,
            type: 'leave',
          });
          return;
        }
        // Wait for the awkward deadline if we sent the last message.
        if (conversation.lastMessage.author === player.id) {
          const awkwardDeadline = conversation.lastMessage.timestamp + AWKWARD_CONVERSATION_TIMEOUT;
          if (now < awkwardDeadline) {
            return;
          }
        }
        // Wait for a cooldown after the last message to simulate "reading" the message.
        const messageCooldown = conversation.lastMessage.timestamp + MESSAGE_COOLDOWN;
        if (now < messageCooldown) {
          return;
        }
        // Grab the lock and send a message!
        console.log(`${player.id} continuing conversation with ${otherPlayer.id}.`);
        const messageUuid = crypto.randomUUID();
        
        conversation.setIsTyping(now, player, messageUuid);
        
        this.startOperation(game, now, 'agentGenerateMessage', {
          worldId: game.worldId,
          playerId: player.id,
          agentId: this.id,
          conversationId: conversation.id,
          otherPlayerId: otherPlayer.id,
          messageUuid,
          type: 'continue',
        });
        return;
      }
    }
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
