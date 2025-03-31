import { ConvexError, v } from 'convex/values';
import { mutation, query, action, internalMutation } from './_generated/server';
import { characters } from '../data/characters';
import { chatCompletion } from './util/llm';
import { Id } from './_generated/dataModel';
import { insertInput } from './aiTown/insertInput';
import { DEFAULT_NAME } from './constants';
import { api, internal } from './_generated/api';
import { agentNames } from './data/agentNames';

// Generate a simple UUID
function generateId(): string {
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => {
    return Math.floor(Math.random() * 16).toString(16);
  });
}

/**
 * 使用与frontendAgent.ts相同的名称生成函数
 * 从agentNames数组中获取一个名称
 */
function generateRandomName(id: number): string {
  // 根据ID获取名称，如果ID超出数组范围则使用取模运算确保在范围内
  const index = (id - 1) % agentNames.length;
  return agentNames[index];
}

/**
 * Generate a unique player ID
 * Use timestamp and random number to ensure uniqueness, and check if it already exists
 */
async function generateUniquePlayerId(ctx: any, worldId: Id<"worlds">): Promise<string> {
  // Create an ID based on timestamp and random number
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 100000);
  const candidateId = `p:${timestamp}${random}`;
  
  // Check if this ID already exists in the playerDescriptions table
  const existingDesc = await ctx.db
    .query('playerDescriptions')
    .withIndex('worldId', (q: any) => 
      q.eq('worldId', worldId).eq('playerId', candidateId)
    )
    .first();
  
  // If it already exists, recursively call to generate a new ID
  if (existingDesc) {
    return generateUniquePlayerId(ctx, worldId);
  }
  
  return candidateId;
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
        // Use the new ID generation function to generate a unique ID
        gamePlayerId = await generateUniquePlayerId(ctx, worldId);
        
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
      // Use the new ID generation function to generate a unique ID
      gamePlayerId = await generateUniquePlayerId(ctx, worldId);
      
      // Add player description to playerDescriptions table
      await ctx.db.insert('playerDescriptions', {
        worldId,
        playerId: gamePlayerId,
        name,
        description,
        character,
      });
    }
    
    // Final check to ensure gamePlayerId is never empty
    if (!gamePlayerId) {
      // Use the new ID generation function to generate a unique ID
      gamePlayerId = await generateUniquePlayerId(ctx, worldId);
      
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

    // First, find and delete playerDescriptions entry regardless of player state
    if (player.gamePlayerId && player.worldId) {
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

/**
 * Custom player creation function - for batch creation
 * No need to provide name and prompt, they will be generated automatically
 */
export const createPlayerBatch = mutation({
  args: {
    walletAddress: v.string(),
    worldId: v.id('worlds'),
    index: v.number(), // Used to generate a unique name
  },
  handler: async (ctx, args) => {
    const { walletAddress, worldId, index } = args;
    
    // Validate wallet address format
    if (!walletAddress.startsWith('0x') || 
        walletAddress.length !== 42 || 
        !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      throw new ConvexError('Invalid wallet address format');
    }
    
    // Check if user already has a player
    const existingPlayer = await ctx.db
      .query('players')
      .withIndex('walletAddress', (q) => q.eq('walletAddress', walletAddress))
      .unique();
    
    if (existingPlayer) {
      throw new ConvexError('This address has already created a player. Please delete the existing player before creating a new one');
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
    
    // Use the new ID generation function to generate a unique ID
    const internalPlayerId = await generateUniquePlayerId(ctx, worldId);
    
    // Generate random name
    const name = generateRandomName(index);
    
    // Generate random description
    const description = generateRandomDescription(name);
    
    // Add player description to playerDescriptions table
    await ctx.db.insert('playerDescriptions', {
      worldId,
      playerId: internalPlayerId,
      name,
      description,
      character,
    });
    
    // Create player record
    const now = Date.now();
    const playerId = await ctx.db.insert('players', {
      walletAddress,
      name,
      character,
      description,
      createdAt: now,
      worldId,
      gamePlayerId: internalPlayerId,
    });
    
    // Update user points (+500)
    await ctx.db.patch(user._id, {
      points: user.points + 500
    });
    
    // Schedule asynchronous AI description generation
    ctx.scheduler.runAfter(0, api.player.regeneratePlayerDescription, { playerId });
    
    return {
      success: true,
      points: user.points + 500
    };
  },
});

/**
 * Generate random player description (internal function, simulating the function in frontendAgent.ts)
 */
function generateRandomDescription(name: string): string {
  // Array of traits and interests
  const positiveTraits = [
    "creative", "analytical", "introverted", "extroverted", "thoughtful", 
    "pragmatic", "energetic", "calm", "adventurous", "cautious", "passionate",
    "logical", "empathetic", "determined", "adaptable", "organized", "flexible"
  ];

  const interests = [
    "technology", "art", "music", "literature", "science", "history", "sports",
    "cooking", "travel", "philosophy", "gaming", "photography", "nature"
  ];

  const backgrounds = [
    "grew up in a small coastal town", "was raised by librarians", 
    "lived in seven different countries", "trained as a classical musician",
    "worked on a cruise ship", "spent a year in silent retreat"
  ];
  
  // Randomly select traits and interests
  const trait1 = positiveTraits[Math.floor(Math.random() * positiveTraits.length)];
  const trait2 = positiveTraits[Math.floor(Math.random() * positiveTraits.length)];
  const interest1 = interests[Math.floor(Math.random() * interests.length)];
  const interest2 = interests[Math.floor(Math.random() * interests.length)];
  const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
  
  // Combine into description
  const description = `${name} is a ${trait1} and ${trait2} individual with a deep passion for ${interest1} and ${interest2}. ${name} ${background}, which influences their perspective on many things. They're known for their unique approach to problem-solving and insightful contributions.`;
  
  return description;
}

/**
 * 内部函数：更新单个玩家的名称
 * 同时更新playerDescriptions和players表
 */
export const updatePlayerName = internalMutation({
  args: {
    playerDescId: v.id('playerDescriptions'),
    playerId: v.string(),
    newName: v.string()
  },
  handler: async (ctx, args) => {
    const { playerDescId, playerId, newName } = args;
    
    // 1. 更新playerDescriptions表中的名称
    await ctx.db.patch(playerDescId, { name: newName });
    
    // 2. 查找并更新对应的players表记录
    const player = await ctx.db
      .query('players')
      .filter((q) => q.eq(q.field('gamePlayerId'), playerId))
      .first();
    
    if (player) {
      await ctx.db.patch(player._id, { name: newName });
      
      // 移除自动触发描述更新的步骤，避免并发冲突
      // ctx.scheduler.runAfter(0, api.player.regeneratePlayerDescription, { 
      //   playerId: player._id 
      // });
    }
    
    return { success: true };
  }
});

/**
 * 批量更新现有玩家的名称 - 将旧的随机名称更新为使用generateRandomName函数生成的名称
 * 为避免一次性处理过多数据，使用分页批量处理
 */
export const migratePlayerNames = action({
  args: {
    batchSize: v.optional(v.number()), // 每批处理的数量，默认50
    cursor: v.optional(v.string()), // 上一批处理的最后一个ID作为游标
    worldId: v.id('worlds'), // 要处理的世界ID
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    processedCount: number;
    skippedCount: number;
    hasMore: boolean;
    nextCursor: string | null;
  }> => {
    const { worldId, cursor } = args;
    const batchSize = args.batchSize || 100;
    let processedCount = 0;
    let skippedCount = 0;
    let lastId: string | null = null;
    
    try {
      // 1. 获取当前批次的玩家描述
      let playerDescriptions;
      
      if (cursor) {
        playerDescriptions = await ctx.runQuery(api.player.getPlayerDescriptionsByCursor, {
          worldId,
          cursor,
          limit: batchSize
        });
      } else {
        playerDescriptions = await ctx.runQuery(api.player.getPlayerDescriptionsBatch, {
          worldId,
          limit: batchSize
        });
      }
      
      // 2. 如果没有更多数据，返回完成消息
      if (playerDescriptions.length === 0) {
        return {
          success: true,
          message: "没有更多玩家需要更新",
          processedCount: 0,
          skippedCount: 0,
          hasMore: false,
          nextCursor: null
        };
      }
      
      // 3. 对每个玩家描述生成新名称并更新
      for (let i = 0; i < playerDescriptions.length; i++) {
        const playerDesc = playerDescriptions[i];
        lastId = playerDesc._id.toString();
        
        // 检查名称是否符合"Player数字_数字"格式
        const nameFormat = /^Player\d+_\d+$/;
        if (!nameFormat.test(playerDesc.name)) {
          // 如果名称不符合指定格式，跳过更新
          skippedCount++;
          continue;
        }
        
        // 从玩家ID提取数字部分作为索引
        // 假设ID格式为 p:123456，提取123456
        let index = 0;
        try {
          const idParts = playerDesc.playerId.split(':');
          if (idParts.length > 1) {
            // 确保是一个数字
            const numPart = idParts[1];
            index = parseInt(numPart, 10);
            if (isNaN(index)) {
              // 如果不是数字，尝试从名称中提取索引
              // 例如 Player2966_492 -> 提取492作为索引
              const nameMatch = playerDesc.name.match(/Player\d+_(\d+)$/);
              if (nameMatch && nameMatch[1]) {
                index = parseInt(nameMatch[1], 10);
              } else {
                // 如果从名称中也无法提取，使用位置索引加上某个大数字
                index = 10000 + i;
              }
            }
          } else {
            // 如果格式不对，尝试从名称中提取索引
            const nameMatch = playerDesc.name.match(/Player\d+_(\d+)$/);
            if (nameMatch && nameMatch[1]) {
              index = parseInt(nameMatch[1], 10);
            } else {
              // 如果从名称中也无法提取，使用位置索引加上某个大数字
              index = 10000 + i;
            }
          }
        } catch (error) {
          // 如果解析出错，尝试从名称中提取索引
          const nameMatch = playerDesc.name.match(/Player\d+_(\d+)$/);
          if (nameMatch && nameMatch[1]) {
            index = parseInt(nameMatch[1], 10);
          } else {
            // 如果从名称中也无法提取，使用位置索引
            index = 10000 + i;
          }
        }
        
        // 生成新名称
        const newName = generateRandomName(index);
        
        // 更新玩家描述
        await ctx.runMutation(internal.player.updatePlayerName, {
          playerDescId: playerDesc._id,
          playerId: playerDesc.playerId,
          newName
        });
        
        // 添加延迟，避免并发冲突
        if (i < playerDescriptions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        processedCount++;
      }
      
      // 4. 返回结果
      const hasMore = playerDescriptions.length === batchSize;
      
      // 5. 自动处理下一批 - 增加延迟时间，减少并发冲突
      if (hasMore && lastId) {
        ctx.scheduler.runAfter(3000, api.player.migratePlayerNames, {
          worldId,
          batchSize: Math.min(batchSize, 20), // 减少批处理大小
          cursor: lastId
        });
      }
      
      return {
        success: true,
        message: `成功更新了 ${processedCount} 个玩家的名称，跳过了 ${skippedCount} 个不符合格式的名称`,
        processedCount,
        skippedCount,
        hasMore,
        nextCursor: hasMore ? lastId : null
      };
    } catch (error: any) {
      console.error('批量更新玩家名称时出错:', error);
      throw new ConvexError(`更新玩家名称失败: ${error.message || '未知错误'}`);
    }
  }
});

/**
 * 获取一批玩家描述（从开始）
 */
export const getPlayerDescriptionsBatch = query({
  args: {
    worldId: v.id('worlds'),
    limit: v.number()
  },
  handler: async (ctx, args) => {
    const { worldId, limit } = args;
    return await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .take(limit);
  }
});

/**
 * 获取一批玩家描述（从指定游标开始）
 */
export const getPlayerDescriptionsByCursor = query({
  args: {
    worldId: v.id('worlds'),
    cursor: v.string(),
    limit: v.number()
  },
  handler: async (ctx, args) => {
    const { worldId, cursor, limit } = args;
    return await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .filter((q) => q.gt(q.field('_id'), cursor))
      .take(limit);
  }
});

/**
 * 启动名称迁移过程
 * 这个函数会触发第一批更新，后续批次由migratePlayerNames函数自己递归处理
 */
export const startNameMigration = mutation({
  args: {
    worldId: v.id('worlds'),
    batchSize: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { worldId, batchSize = 100 } = args;
    
    // 调度执行第一批更新
    ctx.scheduler.runAfter(0, api.player.migratePlayerNames, {
      worldId,
      batchSize
    });
    
    return {
      success: true,
      message: "已启动玩家名称迁移过程，将在后台执行"
    };
  }
});

/**
 * 检查迁移进度
 */
export const checkMigrationProgress = query({
  args: {
    worldId: v.id('worlds')
  },
  handler: async (ctx, args) => {
    const { worldId } = args;
    
    // 查询所有玩家描述数量
    const allDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    
    // 统计需要更新的名称数量（符合Player数字_数字格式的）
    const needsUpdateFormat = /^Player\d+_\d+$/;
    const needsUpdateCount = allDescriptions.filter(desc => 
      needsUpdateFormat.test(desc.name)
    ).length;
    
    // 统计已更新的名称数量（在agentNames数组中的）
    const updatedCount = allDescriptions.filter(desc => 
      agentNames.includes(desc.name)
    ).length;
    
    // 估算进度基于还需要更新的数量
    const remainingToUpdate = needsUpdateCount;
    const estimatedTotal = remainingToUpdate + updatedCount;
    const progress = estimatedTotal > 0 ? Math.min(100, Math.round(updatedCount / estimatedTotal * 100)) : 100;
    
    return {
      totalPlayers: allDescriptions.length,
      needsUpdateCount: needsUpdateCount,
      updatedCount: updatedCount,
      estimatedProgress: progress
    };
  }
});

/**
 * 一次性更新所有符合条件的玩家名称和描述
 */
export const migrateAllPlayerNames = action({
  args: {
    worldId: v.id('worlds')
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    processedCount: number;
    skippedCount: number;
  }> => {
    const { worldId } = args;
    let processedCount = 0;
    let skippedCount = 0;
    
    try {
      // 1. 获取所有玩家描述
      const allPlayerDescriptions = await ctx.runQuery(api.player.getAllPlayerDescriptions, {
        worldId
      });
      
      console.log(`获取到 ${allPlayerDescriptions.length} 个玩家描述，准备处理...`);
      
      // 2. 过滤出符合"Player数字_数字"格式的名称
      const nameFormat = /^Player\d+_\d+$/;
      const playersToUpdate = allPlayerDescriptions.filter(desc => nameFormat.test(desc.name));
      
      console.log(`找到 ${playersToUpdate.length} 个需要更新的玩家（符合Player数字_数字格式）`);
      
      // 3. 更新每个玩家的名称和描述
      for (let i = 0; i < playersToUpdate.length; i++) {
        const playerDesc = playersToUpdate[i];
        
        // 从名称中提取索引
        // 例如 Player2966_492 -> 提取492作为索引
        let index = 0;
        try {
          const nameMatch = playerDesc.name.match(/Player\d+_(\d+)$/);
          if (nameMatch && nameMatch[1]) {
            index = parseInt(nameMatch[1], 10);
          } else {
            // 如果无法从名称中提取，使用位置索引
            index = 10000 + i;
          }
        } catch (error) {
          // 如果解析出错，使用位置索引
          index = 10000 + i;
        }
        
        // 生成新名称
        const newName = generateRandomName(index);
        
        // 更新玩家名称和描述
        try {
          if (!newName) {
            console.error(`无法为玩家 ${playerDesc.playerId} 生成名称，跳过更新`);
            skippedCount++;
            continue;
          }
          
          // 记录调试信息，帮助诊断
          console.log(`准备更新玩家 ${playerDesc.playerId}，新名称: ${newName}`);
          
          // 更新playerDescriptions和players表中的名称
          await ctx.runMutation(internal.player.updatePlayerData, {
            playerDescId: playerDesc._id,
            playerId: playerDesc.playerId,
            newName: newName // 确保传递newName参数
          });
          
          processedCount++;
          
          if (processedCount % 50 === 0) {
            console.log(`已处理 ${processedCount}/${playersToUpdate.length} 玩家...`);
          }
        } catch (error) {
          console.error(`更新玩家 ${playerDesc.playerId} 失败:`, error);
          skippedCount++;
        }
      }
      
      return {
        success: true,
        message: `成功更新了 ${processedCount} 个玩家的名称和描述，跳过了 ${skippedCount} 个出错的玩家`,
        processedCount,
        skippedCount
      };
    } catch (error: any) {
      console.error('批量更新玩家名称时出错:', error);
      throw new ConvexError(`更新玩家名称失败: ${error.message || '未知错误'}`);
    }
  }
});

/**
 * 获取世界中的所有玩家描述
 */
export const getAllPlayerDescriptions = query({
  args: {
    worldId: v.id('worlds')
  },
  handler: async (ctx, args) => {
    const { worldId } = args;
    return await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
  }
});

/**
 * 内部函数：更新单个玩家的名称和描述
 */
export const updatePlayerData = internalMutation({
  args: {
    playerDescId: v.id('playerDescriptions'),
    playerId: v.string(),
    newName: v.string()
  },
  handler: async (ctx, args) => {
    const { playerDescId, playerId, newName } = args;
    
    // 1. 更新playerDescriptions表中的名称
    await ctx.db.patch(playerDescId, { name: newName });
    
    // 2. 查找并更新对应的players表记录
    const player = await ctx.db
      .query('players')
      .filter((q) => q.eq(q.field('gamePlayerId'), playerId))
      .first();
    
    if (player) {
      // 3. 更新players表中的名称
      await ctx.db.patch(player._id, { name: newName });
      
      // 4. 生成并更新描述
      const description = generateRandomDescription(newName);
      
      // 更新players表中的描述
      await ctx.db.patch(player._id, { description });
      
      // 更新playerDescriptions表中的描述
      await ctx.db.patch(playerDescId, { description });
    }
    
    return { success: true };
  }
});

/**
 * 启动名称迁移过程 - 一次性更新所有符合条件的数据
 */
export const startMigrateAllNames = mutation({
  args: {
    worldId: v.id('worlds')
  },
  handler: async (ctx, args) => {
    const { worldId } = args;
    
    // 调度执行更新过程
    ctx.scheduler.runAfter(0, api.player.migrateAllPlayerNames, {
      worldId
    });
    
    return {
      success: true,
      message: "已启动一次性更新所有符合条件的玩家名称和描述的过程"
    };
  }
}); 

