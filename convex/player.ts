import { ConvexError, v } from 'convex/values';
import { mutation, query, action } from './_generated/server';
import { characters } from '../data/characters';
import { chatCompletion } from './util/llm';
import { Id } from './_generated/dataModel';
import { insertInput } from './aiTown/insertInput';
import { DEFAULT_NAME } from './constants';
import { api, internal } from './_generated/api';

// Generate a simple UUID
function generateId(): string {
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => {
    return Math.floor(Math.random() * 16).toString(16);
  });
}

/**
 * Get current player information by wallet address
 */
export const getCurrentPlayerByWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate wallet address format
    if (!args.walletAddress.startsWith('0x') || 
        args.walletAddress.length !== 42 || 
        !/^0x[0-9a-fA-F]{40}$/.test(args.walletAddress)) {
      throw new ConvexError('Invalid wallet address format');
    }
    
    // Find player corresponding to this wallet address
    const player = await ctx.db
      .query('players')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', args.walletAddress))
      .unique();
    
    return player;
  },
});

/**
 * Generate player description using OpenAI
 */
async function generatePlayerDescription(name: string, prompt: string): Promise<string> {
  const systemPrompt = `Generate a detailed character description based on the given inputs: ${name} and ${prompt}.
Output must be in the format: description:"[Generated character description]"
The description should be rich, vivid, and engaging.
If the prompt is brief, expand it into a well-rounded personality, including core traits, behavioral patterns, and background elements.`;

  try {
    const { content } = await chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Name: ${name}, Prompt: ${prompt}` }
      ],
      temperature: 0.7,
    });

    // Extract description part from content
    const match = content.match(/description:"(.*?)"/);
    if (match && match[1]) {
      return match[1];
    }
    
    // If format doesn't match, return the entire content
    return content;
  } catch (error) {
    console.error('Error generating player description:', error);
    return `${name} is a mysterious character with hidden depths. ${prompt}`;
  }
}

/**
 * Create a player
 * When showInGame=true, the player will be displayed in the game (same as joinWorld)
 * When showInGame=false, the player will only be stored in the database, not displayed in the game
 */
export const createPlayer = mutation({
  args: {
    walletAddress: v.string(),
    name: v.string(),
    prompt: v.string(),
    worldId: v.id('worlds'),
    showInGame: v.optional(v.boolean()), // Whether to display in game, default is false
  },
  handler: async (ctx, args) => {
    const { walletAddress, name, prompt, worldId, showInGame = false } = args;
    
    // Validate wallet address format
    if (!walletAddress.startsWith('0x') || 
        walletAddress.length !== 42 || 
        !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      throw new ConvexError('Invalid wallet address format');
    }
    
    // Validate name is not empty
    if (!name.trim()) {
      throw new ConvexError('Player name cannot be empty');
    }
    
    // Check if user already has a player
    const existingPlayer = await ctx.db
      .query('players')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .unique();
    
    if (existingPlayer) {
      throw new ConvexError('You have already created a player. Please delete the existing player before creating a new one');
    }
    
    // Get user information
    const user = await ctx.db
      .query('walletUsers')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .unique();
    
    if (!user) {
      throw new ConvexError('User information not found. Please login first');
    }
    
    // Check if world exists
    const world = await ctx.db.get(worldId);
    if (!world) {
      throw new ConvexError(`Invalid world ID: ${worldId}`);
    }
    
    // Randomly select a character
    const character = characters[Math.floor(Math.random() * characters.length)].name;
    
    // Generate player description using AI
    const description = await generatePlayerDescription(name, prompt);
    
    // Create player record
    const now = Date.now();

    let gamePlayerId = '';
    
    // If display in game is needed, join the game via insertInput
    if (showInGame) {
      // Use the same logic as joinWorld to add player to the game
      const inputId = await insertInput(ctx, worldId, 'join', {
        name,
        character,
        description,
        tokenIdentifier: walletAddress, // Use wallet address as player identifier
      });
      
      // Get updated world data to find the newly joined player ID
      const updatedWorld = await ctx.db.get(worldId);
      if (!updatedWorld) {
        throw new ConvexError('Unable to get updated world data');
      }
      
      // Find player matching wallet address
      const newPlayer = updatedWorld.players.find(p => p.human === walletAddress);
      if (newPlayer) {
        gamePlayerId = newPlayer.id;
      } else {
        // Fallback: If for some reason the player wasn't found in the world data
        const randomIdNumber = Math.floor(Math.random() * 1000000);
        gamePlayerId = `p:${randomIdNumber}`;
        
        // Add player description to playerDescriptions table as fallback
        await ctx.db.insert('playerDescriptions', {
          worldId,
          playerId: gamePlayerId,
          name,
          description,
          character,
        });
      }
    } else {
      // Not displayed in game, but still add player description to playerDescriptions table
      // Create a unique ID for the player in the actual table
      const randomIdNumber = Math.floor(Math.random() * 1000000);
      const internalPlayerId = `p:${randomIdNumber}`; // Use the same format as allocGameId
      
      // Add player description to playerDescriptions table
      await ctx.db.insert('playerDescriptions', {
        worldId,
        playerId: internalPlayerId,
        name,
        description,
        character,
      });
      
      gamePlayerId = internalPlayerId;
    }
    
    // Final check to ensure gamePlayerId is never empty
    if (!gamePlayerId) {
      const randomIdNumber = Math.floor(Math.random() * 1000000);
      gamePlayerId = `p:${randomIdNumber}`;
      
      // Add player description to playerDescriptions table as fallback
      await ctx.db.insert('playerDescriptions', {
        worldId,
        playerId: gamePlayerId,
        name,
        description,
        character,
      });
    }
    
    // Create player record, regardless of game display status
    const playerId = await ctx.db.insert('players', {
      walletAddress,
      name,
      character,
      description,
      createdAt: now,
      worldId,
      gamePlayerId,  // Store player ID in game or internally generated ID
    });
    
    // Update user points (+500)
    await ctx.db.patch(user._id, {
      points: user.points + 500
    });
    
    return {
      success: true,
      player: await ctx.db.get(playerId),
      points: user.points + 500
    };
  },
});

/**
 * Delete player
 */
export const deletePlayer = mutation({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const { walletAddress } = args;
    
    // Validate wallet address format
    if (!walletAddress.startsWith('0x') || 
        walletAddress.length !== 42 || 
        !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      throw new ConvexError('Invalid wallet address format');
    }
    
    // Find user's player
    const player = await ctx.db
      .query('players')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .unique();
    
    if (!player) {
      throw new ConvexError('Could not find your player');
    }

    // Check if player is displayed in game
    const world = await ctx.db.get(player.worldId);
    if (world) {
      // Check if there is a corresponding actual game player
      const gamePlayer = world.players.find(p => p.human === walletAddress);
      
      if (gamePlayer) {
        // If player is in game, use leaveWorld logic to let player leave the game
        await insertInput(ctx, player.worldId, 'leave', {
          playerId: gamePlayer.id,
        });
      } else {
        // Player not in game, just delete data in playerDescriptions
        if (player.gamePlayerId) {
          const playerDescriptions = await ctx.db
            .query('playerDescriptions')
            .withIndex('worldId', (q) => 
              q.eq('worldId', player.worldId).eq('playerId', player.gamePlayerId as string)
            )
            .unique();
          
          if (playerDescriptions) {
            await ctx.db.delete(playerDescriptions._id);
          }
        }
      }
    }
    
    // Delete player record
    await ctx.db.delete(player._id);
    
    return {
      success: true,
      message: 'Player has been successfully deleted'
    };
  },
});

/**
 * Get all players (can be used for admin interface)
 */
export const getAllPlayers = query({
  handler: async (ctx) => {
    return await ctx.db.query('players').collect();
  },
});

/**
 * Get all players created by a specific user
 */
export const getPlayersByWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const { walletAddress } = args;
    
    // Validate wallet address format
    if (!walletAddress.startsWith('0x') || 
        walletAddress.length !== 42 || 
        !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      throw new ConvexError('Invalid wallet address format');
    }
    
    // Find all players corresponding to this wallet address
    const players = await ctx.db
      .query('players')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .collect();
    
    return players;
  },
});

/**
 * Simulate a conversation with a random agent
 * Generates 8 total messages (4 each) using the agent identity, plan, and player description
 */
export const simulateConversationWithAgent = action({
  args: {
    walletAddress: v.string(),
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    agent: {
      id: string;
      identity: string;
      plan: string;
    };
    player: {
      id: string;
      name: string;
      description: string;
    };
    conversation: Array<{
      speaker: string;
      text: string;
    }>;
    pointsEarned: number;
    totalPoints: number;
  }> => {
    const { walletAddress, worldId } = args;
    
    // Validate wallet address format
    if (!walletAddress.startsWith('0x') || 
        walletAddress.length !== 42 || 
        !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      throw new ConvexError('Invalid wallet address format');
    }
    
    // Find user's player
    const player = await ctx.runQuery(api.player.getCurrentPlayerByWallet, { walletAddress });
    
    if (!player) {
      throw new ConvexError('Player not found, please create a player first');
    }
    
    // Get world data
    const worldData = await ctx.runQuery(internal.aiTown.game.getWorld, { worldId });
    if (!worldData) {
      throw new ConvexError(`Invalid world ID: ${worldId}`);
    }
    
    // Get all agent descriptions for this world
    const agentDescriptions: Array<{
      agentId: string;
      identity: string;
      plan: string;
    }> = await ctx.runQuery(internal.aiTown.game.getAgentDescriptions, { worldId });
    
    if (!agentDescriptions || agentDescriptions.length === 0) {
      throw new ConvexError('No agents available in this world');
    }
    
    // Randomly select an agent
    const randomAgentDescription = agentDescriptions[Math.floor(Math.random() * agentDescriptions.length)];
    
    // Get player description
    const playerDescriptions: Array<{
      playerId: string;
      name: string;
      description: string;
    }> = await ctx.runQuery(internal.aiTown.game.getPlayerDescriptions, { worldId });
    
    // Find this player's description
    const playerDescription = playerDescriptions.find((pd: { playerId: string }) => pd.playerId === player.gamePlayerId);
    
    if (!playerDescription) {
      throw new ConvexError('Player description not found');
    }
    
    // Get user information for points update
    const user = await ctx.runQuery(api.wallet.getUserByWalletAddress, { walletAddress });
    
    if (!user) {
      throw new ConvexError('User information not found. Please login first');
    }
    
    // Generate conversation using OpenAI
    const systemPrompt = `You are simulating a conversation between two characters in a virtual world:
1. ${playerDescription.name}: ${playerDescription.description}
2. An AI agent with the following identity: ${randomAgentDescription.identity}
And the following plan: ${randomAgentDescription.plan}

Generate a realistic back-and-forth conversation between these two characters. The conversation should be natural,
interesting, and reflect the personalities and goals of both characters. Create exactly 8 messages total (4 from each character).
Start with the AI agent speaking first.

Format the conversation as follows:
agent: [agent's first message]
player: [player's first response]
agent: [agent's second message]
player: [player's second response]
...and so on for exactly 8 messages total (4 from each character)`;

    try {
      const { content } = await chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate the conversation now.' }
        ],
        temperature: 0.7,
      });
      
      // Parse the conversation into an array of messages
      const conversationLines = content.split('\n').filter(line => line.trim() !== '');
      const messages = [];
      
      for (const line of conversationLines) {
        const [speaker, ...messageParts] = line.split(':');
        const messageText = messageParts.join(':').trim();
        
        if (speaker && messageText) {
          // Only accept 'agent' or 'player' as valid speakers
          const speakerTrimmed = speaker.trim().toLowerCase();
          if (speakerTrimmed === 'agent' || speakerTrimmed === 'player') {
            messages.push({
              speaker: speakerTrimmed,
              text: messageText
            });
          }
        }
      }
      
      // Ensure we have exactly 8 messages (4 from each)
      if (messages.length > 8) {
        // If we have more than 8, truncate to first 8
        messages.splice(8);
      }
      
      // Validate we have proper alternating pattern (agent-player-agent-player...)
      let validMessageCount = 0;
      const validMessages = [];
      let expectedSpeaker = 'agent'; // Start with agent
      
      for (const message of messages) {
        if (message.speaker === expectedSpeaker) {
          validMessages.push(message);
          validMessageCount++;
          // Toggle expected speaker
          expectedSpeaker = expectedSpeaker === 'agent' ? 'player' : 'agent';
          
          // Stop if we have 8 valid messages
          if (validMessageCount === 8) {
            break;
          }
        }
      }
      
      // Award 40 points to the user
      const newPoints: number = user.points + 40;
      await ctx.runMutation(api.wallet.updateUserPoints, {
        walletAddress,
        points: newPoints
      });
      
      // Ensure only 8 messages are returned
      const finalMessages = validMessages.length === 8 ? validMessages : messages.slice(0, 8);
      
      // Force limit to 8 messages, regardless of previous logic
      if (finalMessages.length > 8) {
        finalMessages.length = 8;
      }
      
      return {
        success: true,
        agent: {
          id: randomAgentDescription.agentId,
          identity: randomAgentDescription.identity,
          plan: randomAgentDescription.plan
        },
        player: {
          id: playerDescription.playerId,
          name: playerDescription.name,
          description: playerDescription.description
        },
        conversation: finalMessages,
        pointsEarned: 40,
        totalPoints: newPoints
      };
    } catch (error: any) {
      console.error('Error generating conversation:', error);
      throw new ConvexError(`Failed to generate conversation: ${error.message || 'Unknown error'}`);
    }
  },
}); 