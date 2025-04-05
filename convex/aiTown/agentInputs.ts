import { v } from 'convex/values';
import { agentId, conversationId, parseGameId } from './ids';
import { Player, activity } from './player';
import { Conversation, conversationInputs } from './conversation';
import { movePlayer, blocked } from './movement';
import { inputHandler } from './inputHandler';
import { point } from '../util/types';
import { Descriptions } from '../../data/characters';
import { AgentDescription } from './agentDescription';
import { Agent } from './agent';
import { generateEncryptedEthWallet } from '../util/ethWallet';
import process from 'process';
import { Value } from 'convex/values';

export const agentInputs = {
  finishRememberConversation: inputHandler({
    args: {
      operationId: v.string(),
      agentId,
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} isn't remembering ${args.operationId}`);
      } else {
        delete agent.inProgressOperation;
        delete agent.toRemember;
      }
      return null;
    },
  }),
  finishDoSomething: inputHandler({
    args: {
      operationId: v.string(),
      agentId: v.id('agents'),
      destination: v.optional(point),
      invitee: v.optional(v.id('players')),
      activity: v.optional(activity),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} didn't have ${args.operationId} in progress`);
        return null;
      }
      delete agent.inProgressOperation;
      const player = game.world.players.get(agent.playerId)!;
      if (args.invitee) {
        const inviteeId = parseGameId('players', args.invitee);
        const invitee = game.world.players.get(inviteeId);
        if (!invitee) {
          throw new Error(`Couldn't find player: ${inviteeId}`);
        }
        Conversation.start(game, now, player, invitee);
        agent.lastInviteAttempt = now;
      }
      if (args.destination) {
        const destinationBlocked = blocked(game, now, args.destination, player.id);
        if (destinationBlocked) {
          console.warn(`Agent ${agentId} destination is blocked: ${destinationBlocked}`, args.destination);
          
          const alternatives = [];
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              
              const alt = {
                x: Math.floor(args.destination.x) + dx,
                y: Math.floor(args.destination.y) + dy
              };
              
              if (!blocked(game, now, alt, player.id)) {
                alternatives.push(alt);
              }
            }
          }
          
          if (alternatives.length > 0) {
            const randomIndex = Math.floor(Math.random() * alternatives.length);
            const safeDestination = alternatives[randomIndex];
            console.log(`Agent ${agentId} using alternative destination`, safeDestination);
            movePlayer(game, now, player, safeDestination);
          } else {
            console.log(`Agent ${agentId} cannot find a valid destination nearby`);
          }
        } else {
          movePlayer(game, now, player, args.destination);
        }
      }
      if (args.activity) {
        player.activity = args.activity;
      }
      return null;
    },
  }),
  agentFinishSendingMessage: inputHandler({
    args: {
      agentId,
      conversationId,
      timestamp: v.number(),
      operationId: v.string(),
      leaveConversation: v.boolean(),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      const player = game.world.players.get(agent.playerId);
      if (!player) {
        throw new Error(`Couldn't find player: ${agent.playerId}`);
      }
      const conversationId = parseGameId('conversations', args.conversationId);
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Couldn't find conversation: ${conversationId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} wasn't sending a message ${args.operationId}`);
        return null;
      }
      
      delete agent.inProgressOperation;
      conversationInputs.finishSendingMessage.handler(game, now, {
        playerId: agent.playerId,
        conversationId: args.conversationId,
        timestamp: args.timestamp,
      });
      if (args.leaveConversation) {
        conversation.leave(game, now, player);
      }
      return null;
    },
  }),
  inviteToConversation: inputHandler({
    args: {
      agentId: v.string(),
      invitee: v.optional(v.string()),
    },
    handler: (game, now, args): string | number | null => {
      const agent = game.world.agents.get(parseGameId('agents', args.agentId));
      if (!agent) {
        throw new Error(`Invalid agent ID ${args.agentId}`);
      }
      const player = game.world.players.get(agent.playerId)!;
      if (args.invitee) {
        const inviteeId = parseGameId('players', args.invitee);
        const invitee = game.world.players.get(inviteeId);
        if (!invitee) {
          throw new Error(`Invalid player ID ${args.invitee}`);
        }
        
        const result = Conversation.start(game, now, player, invitee);
        agent.lastInviteAttempt = now;
        
        if (!result.conversationId) {
          return null;
        }
        
        return result.conversationId;
      } else {
        return typeof agent.lastInviteAttempt === 'number' ? agent.lastInviteAttempt : null;
      }
    },
  }),
  createAgent: inputHandler({
    args: {
      descriptionIndex: v.number(),
    },
    handler: (game, now, args) => {
      const description = Descriptions[args.descriptionIndex];
      const playerId = Player.join(
        game,
        now,
        description.name,
        description.character,
        description.identity,
      );
      
      // Generate wallet for agent
      const encryptionKey = process.env.WALLET_ENCRYPTION_KEY || '';
      const wallet = generateEncryptedEthWallet(encryptionKey);
      
      const agentId = game.allocId('agents');
      game.world.agents.set(
        agentId,
        new Agent({
          id: agentId,
          playerId: playerId,
          inProgressOperation: undefined,
          lastConversation: undefined,
          lastInviteAttempt: undefined,
          toRemember: undefined,
        }),
      );
      
      // Store wallet information in agentDescriptions
      game.agentDescriptions.set(
        agentId,
        new AgentDescription({
          agentId: agentId,
          identity: description.identity,
          plan: description.plan,
          // Add wallet information
          walletAddress: wallet.address,
          walletPublicKey: wallet.publicKey,
          encryptedPrivateKey: wallet.encryptedPrivateKey,
          // Add new fields
          energy: 100, // Initial value 100
          inferences: 0, // Initial value 0 
          tips: 0 // Initial value 0
        }),
      );
      
      console.log(`Created agent ${agentId} with wallet address ${wallet.address}`);
      
      return { agentId };
    },
  }),
  updateAgentInferences: inputHandler({
    args: {
      agentId: v.string(),
      inferences: v.number(),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agentDescription = game.agentDescriptions.get(agentId);
      
      if (agentDescription) {
        // Update the agent's inferences count
        agentDescription.inferences = args.inferences;
        console.log(`Agent ${agentId} inferences updated to ${args.inferences}`);
      } else {
        console.warn(`Agent ${agentId} not found, unable to update inferences`);
      }
      
      return null;
    },
  }),
};
