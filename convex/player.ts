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
    walletAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { walletAddress } = args;
    
    // Return message if no wallet address is provided
    if (!walletAddress) {
      return {
        success: false,
        message: 'Please provide a wallet address',
        player: null
      };
    }
    
    // Validate wallet address format
    if (!walletAddress.startsWith('0x') || 
        walletAddress.length !== 42 || 
        !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return {
        success: false,
        message: 'Invalid wallet address format',
        player: null
      };
    }
    
    // Find player corresponding to this wallet address
    const player = await ctx.db
      .query('players')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .unique();
    
    if (!player) {
      return {
        success: false,
        message: 'No player found for this wallet address',
        player: null
      };
    }
    
    return {
      success: true,
      message: 'Player found',
      player
    };
  },
});

/**
 * Generate player description using AI
 * This action only handles AI description generation
 */
export const generatePlayerDescription = action({
  args: {
    name: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const { name, prompt } = args;
    const systemPrompt = `Generate a concise character description based on the given inputs: ${name} and ${prompt}.
Your description MUST be between 55-75 words total.
The description should be vivid and engaging, focusing on the most important personality traits.
If the prompt is brief, expand it into a well-rounded personality with core traits.
IMPORTANT: Your description MUST be a complete passage with no unfinished sentences or trailing ellipses.
DO NOT include "description:" at the beginning of your response.`;

    try {
      const { content } = await chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Name: ${name}, Prompt: ${prompt}` }
        ],
        temperature: 0.7,
      });

      // Remove "description:" prefix if present
      let description = content.replace(/^description:/i, "").trim();
      
      // Remove any trailing ellipses if they exist
      description = description.replace(/\.\.\.+$/, ".").trim();
      
      // Count words
      const words = description.split(/\s+/);
      
      if (words.length < 55) {
        // If too short, use the original prompt as fallback with name
        description = `${name} is an intriguing character with ${prompt}. They have a captivating personality that draws others to them naturally. With a unique perspective on the world, ${name} brings depth and warmth to every interaction, making lasting impressions on everyone they meet.`;
      } else if (words.length > 75) {
        // If too long, truncate at the last sentence boundary before 75 words
        // First join the first 75 words
        const truncated = words.slice(0, 75).join(" ");
        // Find the last sentence boundary
        const lastSentence = truncated.match(/.*\./);
        if (lastSentence) {
          description = lastSentence[0];
        } else {
          // If no sentence boundary found, just add a period
          description = truncated + ".";
        }
      }
      
      return description;
    } catch (error) {
      console.error('Error generating player description:', error);
      return `${name} is a mysterious character with hidden depths. ${prompt}`;
    }
  }
});

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
    
    // For description, use a fallback since we can't call action from mutation
    // Will need to be generated/updated separately
    let description = `${name} is a character in the world. ${prompt}`;
    
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
    
    // Schedule an AI description generation (asynchronously, will not block)
    // This will be executed after the player is created
    ctx.scheduler.runAfter(0, api.player.regeneratePlayerDescription, { playerId });
    
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
    walletAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { walletAddress } = args;
    
    // Return message if no wallet address is provided
    if (!walletAddress) {
      return {
        success: false,
        message: 'Please provide a wallet address',
        players: []
      };
    }
    
    // Validate wallet address format
    if (!walletAddress.startsWith('0x') || 
        walletAddress.length !== 42 || 
        !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return {
        success: false,
        message: 'Invalid wallet address format',
        players: []
      };
    }
    
    // Find all players corresponding to this wallet address
    const players = await ctx.db
      .query('players')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .collect();
    
    return {
      success: true,
      message: players.length > 0 ? 'Players found' : 'No players found for this wallet address',
      players
    };
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
      name: string;
    };
    player: {
      id: string;
      name: string;
      description: string;
    };
    conversation: Array<{
      speaker: string;
      text: string;
      isAgent: boolean;
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
    
    // 1. Get player, user, and world data in parallel
    const [playerResult, worldState, user] = await Promise.all([
      ctx.runQuery(api.player.getCurrentPlayerByWallet, { walletAddress }),
      ctx.runQuery(api.world.worldState, { worldId }),
      ctx.runQuery(api.wallet.getUserByWalletAddress, { walletAddress })
    ]);
    
    if (!playerResult.success || !playerResult.player) {
      throw new ConvexError('Player not found, please create a player first');
    }
    
    if (!user) {
      throw new ConvexError('User information not found. Please login first');
    }
    
    if (!worldState || !worldState.world || !worldState.world.agents) {
      throw new ConvexError('Could not retrieve world data');
    }
    
    const player = playerResult.player;
    
    // 2. Get descriptions data in parallel
    const [agentDescriptions, playerDescriptions] = await Promise.all([
      ctx.runQuery(internal.aiTown.game.getAgentDescriptions, { worldId }),
      ctx.runQuery(internal.aiTown.game.getPlayerDescriptions, { worldId })
    ]);
    
    if (!agentDescriptions || agentDescriptions.length === 0) {
      throw new ConvexError('No agents available in this world');
    }
    
    // 3. Select random agent and find player descriptions
    const randomAgentDescription = agentDescriptions[Math.floor(Math.random() * agentDescriptions.length)];
    const agentData = worldState.world.agents.find((a: { id: string }) => a.id === randomAgentDescription.agentId);
    
    if (!agentData) {
      throw new ConvexError('Agent data not found in world');
    }
    
    const playerDescription = playerDescriptions.find((pd: { playerId: string }) => pd.playerId === player.gamePlayerId);
    const agentPlayerDescription = playerDescriptions.find((pd: { playerId: string }) => pd.playerId === agentData.playerId);
    
    if (!playerDescription || !agentPlayerDescription) {
      throw new ConvexError('Player or agent description not found');
    }
    
    // Get names
    const playerName = playerDescription.name;
    const agentName = agentPlayerDescription.name;
    
    // 4. Generate conversation using OpenAI
    const systemPrompt = `You are simulating a conversation between two characters in a virtual world:
1. ${playerName}: ${playerDescription.description}
2. An AI agent named ${agentName} with the following identity: ${randomAgentDescription.identity}
And the following plan: ${randomAgentDescription.plan}

Generate a realistic back-and-forth conversation between these two characters. The conversation should be natural,
interesting, and reflect the personalities and goals of both characters. Create exactly 8 messages total (4 from each character).
Start with the AI agent speaking first.

Format the conversation as follows:
${agentName}: [agent's first message]
${playerName}: [player's first response]
${agentName}: [agent's second message]
${playerName}: [player's second response]
...and so on for exactly 8 messages total (4 from each character)`;

    try {
      const { content } = await chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate the conversation now.' }
        ],
        temperature: 0.7,
      });
      
      // 5. Parse and normalize conversation - simplified approach
      const messages: Array<{ speaker: string; text: string; isAgent: boolean }> = [];
      const conversationLines = content.split('\n').filter(line => line.trim() !== '');
      
      // Process each line and try to extract speaker and message
      conversationLines.forEach(line => {
        const [speaker, ...messageParts] = line.split(':');
        const messageText = messageParts.join(':').trim();
        
        if (speaker && messageText) {
          const speakerName = speaker.trim();
          // Normalize speaker name to one of our two characters
          if (speakerName.toLowerCase() === agentName.toLowerCase() || 
              (messages.length === 0 || (messages.length > 0 && messages[messages.length - 1].speaker === playerName))) {
            messages.push({ 
              speaker: agentName, 
              text: messageText,
              isAgent: true
            });
          } else {
            messages.push({ 
              speaker: playerName, 
              text: messageText,
              isAgent: false 
            });
          }
        }
      });
      
      // Ensure the conversation starts with agent and alternates properly
      const normalizedMessages: Array<{ speaker: string; text: string; isAgent: boolean }> = [];
      let currentSpeaker = agentName; // Start with agent
      let isCurrentSpeakerAgent = true; // Start with agent
      
      // Takes at most 8 messages, ensuring proper alternation
      while (normalizedMessages.length < 8 && messages.length > 0) {
        // Find the next message from the expected speaker
        const nextMsgIndex = messages.findIndex(m => m.speaker === currentSpeaker);
        
        if (nextMsgIndex >= 0) {
          normalizedMessages.push(messages[nextMsgIndex]);
          messages.splice(nextMsgIndex, 1);
        } else if (messages.length > 0) {
          // If no matching speaker found but we have messages, force the pattern
          const message = messages.shift()!;
          normalizedMessages.push({ 
            speaker: currentSpeaker, 
            text: message.text,
            isAgent: isCurrentSpeakerAgent
          });
        } else {
          break;
        }
        
        // Toggle speaker for next iteration
        currentSpeaker = currentSpeaker === agentName ? playerName : agentName;
        isCurrentSpeakerAgent = !isCurrentSpeakerAgent;
      }
      
      // If we don't have 8 messages, fill in with placeholder messages
      while (normalizedMessages.length < 8) {
        normalizedMessages.push({
          speaker: currentSpeaker,
          text: currentSpeaker === agentName ? 
            "I'm enjoying our conversation." : 
            "That's interesting to hear.",
          isAgent: currentSpeaker === agentName
        });
        currentSpeaker = currentSpeaker === agentName ? playerName : agentName;
        isCurrentSpeakerAgent = !isCurrentSpeakerAgent;
      }
      
      // 6. Award points and return result
      const newPoints: number = user.points + 40;
      await ctx.runMutation(api.wallet.updateUserPoints, {
        walletAddress,
        points: newPoints
      });
      
      return {
        success: true,
        agent: {
          id: randomAgentDescription.agentId,
          identity: randomAgentDescription.identity,
          plan: randomAgentDescription.plan,
          name: agentName
        },
        player: {
          id: playerDescription.playerId,
          name: playerDescription.name,
          description: playerDescription.description
        },
        conversation: normalizedMessages,
        pointsEarned: 40,
        totalPoints: newPoints
      };
    } catch (error: any) {
      console.error('Error generating conversation:', error);
      throw new ConvexError(`Failed to generate conversation: ${error.message || 'Unknown error'}`);
    }
  },
});

/**
 * Get player by ID
 */
export const getPlayerById = query({
  args: {
    playerId: v.id('players')
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.playerId);
  }
});

/**
 * Update the player description in the database
 */
export const updatePlayerDescriptionInDB = mutation({
  args: {
    playerId: v.id('players'),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const { playerId, description } = args;
    
    // Get the player to validate and get worldId and gamePlayerId
    const player = await ctx.db.get(playerId);
    if (!player) {
      throw new ConvexError('Player not found');
    }
    
    // Update player record
    await ctx.db.patch(playerId, { description });
    
    // Also update description in playerDescriptions if it exists
    if (player.gamePlayerId && player.worldId) {
      const playerDescription = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => 
          q.eq('worldId', player.worldId).eq('playerId', player.gamePlayerId as string)
        )
        .unique();
      
      if (playerDescription) {
        await ctx.db.patch(playerDescription._id, { description });
      }
    }
    
    return { success: true };
  }
});

/**
 * Action that orchestrates updating player description with AI
 * Uses a two-step process to avoid context errors
 */
export const regeneratePlayerDescription = action({
  args: {
    playerId: v.id('players'),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
  }> => {
    const { playerId } = args;
    
    try {
      // Step 1: Get the player info from the database
      const player = await ctx.runQuery(api.player.getPlayerById, { playerId });
      if (!player) {
        throw new ConvexError('Player not found');
      }
      
      // Step 2: Generate description using our AI action
      const description = await ctx.runAction(api.player.generatePlayerDescription, {
        name: player.name,
        prompt: player.description || ""
      });
      
      // Step 3: Update the player in the database using our mutation
      await ctx.runMutation(api.player.updatePlayerDescriptionInDB, {
        playerId,
        description
      });
      
      return {
        success: true,
        message: "Player description updated successfully"
      };
    } catch (error: any) {
      console.error('Error updating player description:', error);
      throw new ConvexError(`Failed to update player description: ${error.message || 'Unknown error'}`);
    }
  }
}); 