import { Infer, v } from 'convex/values';
import { Doc, Id } from '../_generated/dataModel';
import {
  ActionCtx,
  DatabaseReader,
  MutationCtx,
  internalMutation,
  internalQuery,
} from '../_generated/server';
import { World, serializedWorld } from './world';
import { WorldMap, serializedWorldMap } from './worldMap';
import { PlayerDescription, serializedPlayerDescription } from './playerDescription';
import { Location, locationFields, playerLocation } from './location';
import { runAgentOperation } from './agent';
import { GameId, IdTypes, allocGameId } from './ids';
import { InputArgs, InputNames, inputs } from './inputs';
import {
  AbstractGame,
  EngineUpdate,
  applyEngineUpdate,
  engineUpdate,
  loadEngine,
} from '../engine/abstractGame';
import { internal } from '../_generated/api';
import { HistoricalObject } from '../engine/historicalObject';
import { AgentDescription, serializedAgentDescription } from './agentDescription';
import { parseMap, serializeMap } from '../util/object';
import { query } from '../_generated/server';

const gameState = v.object({
  world: v.object(serializedWorld),
  playerDescriptions: v.array(v.object(serializedPlayerDescription)),
  agentDescriptions: v.array(v.object(serializedAgentDescription)),
  worldMap: v.object(serializedWorldMap),
});
type GameState = Infer<typeof gameState>;

const gameStateDiff = v.object({
  world: v.object(serializedWorld),
  playerDescriptions: v.optional(v.array(v.object(serializedPlayerDescription))),
  agentDescriptions: v.optional(v.array(v.object(serializedAgentDescription))),
  worldMap: v.optional(v.object(serializedWorldMap)),
  agentOperations: v.array(v.object({ name: v.string(), args: v.any() })),
});
type GameStateDiff = Infer<typeof gameStateDiff>;

export class Game extends AbstractGame {
  tickDuration = 16;  // Keep 16ms per frame for smooth animation
  stepDuration = 300; // Further reduced to 300ms for even more frequent updates
  maxTicksPerStep = 600;
  maxInputsPerStep = 500; // Increased to 500 to handle more inputs per step

  // Tracking parameters for input optimization
  lastInputCounts: Map<string, number> = new Map();
  inputRateLimits: Map<string, number> = new Map();
  maxAllowedPathfinds = 40; // Increased from 20 to 40 pathfinding operations per step

  // Additional throttling parameters for movement
  private lastGlobalMovementProcessTime = 0;
  private maxMovementInputsPerStep = 30; // Doubled from 15 to 30 movement inputs per step
  private minTimeBetweenMovementSteps = 150; // Reduced from 500ms to 150ms

  world: World;

  historicalLocations: Map<GameId<'players'>, HistoricalObject<Location>>;

  descriptionsModified: boolean;
  worldMap: WorldMap;
  playerDescriptions: Map<GameId<'players'>, PlayerDescription>;
  agentDescriptions: Map<GameId<'agents'>, AgentDescription>;

  pendingOperations: Array<{ name: string; args: any }> = [];

  numPathfinds: number;

  constructor(
    engine: Doc<'engines'>,
    public worldId: Id<'worlds'>,
    state: GameState,
  ) {
    super(engine);

    this.world = new World(state.world);
    delete this.world.historicalLocations;

    this.descriptionsModified = false;
    this.worldMap = new WorldMap(state.worldMap);
    this.agentDescriptions = parseMap(state.agentDescriptions, AgentDescription, (a) => a.agentId);
    this.playerDescriptions = parseMap(
      state.playerDescriptions,
      PlayerDescription,
      (p) => p.playerId,
    );

    this.historicalLocations = new Map();

    // Reset pathfinding counter
    this.numPathfinds = 0;
    
    // Add this comment to highlight the importance:
    // Reduce input processing limits to prevent agent movement stuttering
    // These values control how many inputs will be processed in each type category
    this.inputRateLimits.clear(); // Reset to default values
    this.inputRateLimits.set('moveTo', 10);          // Increased from 3 to 10
    this.inputRateLimits.set('finishDoSomething', 20); // Increased from 10 to 20
    this.inputRateLimits.set('agentFinishSendingMessage', 10); // Increased from 5 to 10
    this.inputRateLimits.set('update', 10);           // Increased from 5 to 10
  }

  static async load(
    db: DatabaseReader,
    worldId: Id<'worlds'>,
    generationNumber: number,
  ): Promise<{ engine: Doc<'engines'>; gameState: GameState }> {
    const worldDoc = await db.get(worldId);
    if (!worldDoc) {
      throw new Error(`No world found with id ${worldId}`);
    }
    const worldStatus = await db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    if (!worldStatus) {
      throw new Error(`No engine found for world ${worldId}`);
    }
    const engine = await loadEngine(db, worldStatus.engineId, generationNumber);
    const playerDescriptionsDocs = await db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const agentDescriptionsDocs = await db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const worldMapDoc = await db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    if (!worldMapDoc) {
      throw new Error(`No map found for world ${worldId}`);
    }
    // Discard the system fields and historicalLocations from the world state.
    const { _id, _creationTime, historicalLocations: _, ...world } = worldDoc;
    const playerDescriptions = playerDescriptionsDocs
      // Discard player descriptions for players that no longer exist.
      .filter((d) => !!world.players.find((p) => p.id === d.playerId))
      .map(({ _id, _creationTime, worldId: _, ...doc }) => doc);
    const agentDescriptions = agentDescriptionsDocs
      .filter((a) => !!world.agents.find((p) => p.id === a.agentId))
      .map(({ _id, _creationTime, worldId: _, ...doc }) => doc);
    const {
      _id: _mapId,
      _creationTime: _mapCreationTime,
      worldId: _mapWorldId,
      ...worldMap
    } = worldMapDoc;
    return {
      engine,
      gameState: {
        world,
        playerDescriptions,
        agentDescriptions,
        worldMap,
      },
    };
  }

  allocId<T extends IdTypes>(idType: T): GameId<T> {
    if (idType === 'players') {
      // For players, use a simple sequential ID pattern: p:1, p:2, p:3, etc.
      // Find the highest existing player ID to ensure we use the next number
      const playerIds = Array.from(this.world.players.keys()).map(id => {
        const match = id.match(/^p:(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
      
      // If no players exist yet, start from 1, otherwise use the next number
      const nextNum = playerIds.length > 0 ? Math.max(...playerIds) + 1 : 1;
      return allocGameId(idType, nextNum);
    } else {
      // For other ID types, use the existing approach
      const id = allocGameId(idType, this.world.nextId);
      this.world.nextId += 1;
      return id;
    }
  }

  scheduleOperation(name: string, args: unknown) {
    this.pendingOperations.push({ name, args });
  }

  handleInput<Name extends InputNames>(now: number, name: Name, args: InputArgs<Name>) {
    const handler = inputs[name]?.handler;
    if (!handler) {
      throw new Error(`Invalid input: ${name}`);
    }
    
    // Log all input processing
    console.log(`Processing game input: ${name}`);
    
    // Identify if this is a movement-related input
    const isMovementInput = (
      name === 'moveTo' || 
      (name === 'finishDoSomething' && typeof args === 'object' && args && 'destination' in args)
    );
    
    try {
      // More permissive throttling for movement inputs at the Game class level
      if (isMovementInput) {
        // Apply a global pause between ALL movement processing
        if (now - this.lastGlobalMovementProcessTime < this.minTimeBetweenMovementSteps) {
          // Allow more movements to pass through even during cooldown (80% chance)
          if (Math.random() < 0.8) {
            console.log(`Movement cooldown active but allowing anyway: ${now - this.lastGlobalMovementProcessTime}ms`);
          } else {
            console.log(`🚫 GAME THROTTLING: Global movement cooldown in effect. Last movement processed ${now - this.lastGlobalMovementProcessTime}ms ago. Waiting...`);
            return null;
          }
        }
        
        // Update the timestamp for movement processing
        this.lastGlobalMovementProcessTime = now;
      }
      
      // Get the entity ID for rate limiting
      let entityId = null;
      let isAgentEntity = false;
      
      if (typeof args === 'object' && args) {
        if ('playerId' in args) {
          entityId = args.playerId;
          // Check if this player is controlled by an agent
          for (const agent of this.world.agents.values()) {
            if (agent.playerId === entityId) {
              isAgentEntity = true;
              break;
            }
          }
        } else if ('agentId' in args) {
          entityId = args.agentId;
          isAgentEntity = true;
        }
      }
      
      // Less restrictive rate limiting for agent movement inputs
      if (isMovementInput && isAgentEntity && entityId) {
        const inputKey = `${name}:${entityId}`;
        const currentCount = this.lastInputCounts.get(inputKey) || 0;
        
        // Dynamically set limits based on agent's state
        let allowedLimit = this.inputRateLimits.get(name as string) || 3; // Increased default to 3
        
        // If player is found and is already moving, but nearly complete, allow new movement
        if (entityId) {
          let player = null;
          
          // Find the player for this entity
          if (isAgentEntity && 'agentId' in args) {
            // Get the player through the agent
            const agent = this.world.agents.get(entityId as GameId<'agents'>);
            if (agent) {
              player = this.world.players.get(agent.playerId);
            }
          } else if ('playerId' in args) {
            // Direct player reference
            player = this.world.players.get(entityId as GameId<'players'>);
          }
          
          // If player is moving but very close to destination, allow new input
          if (player && player.pathfinding && player.pathfinding.state.kind === 'moving') {
            const destination = player.pathfinding.destination;
            const position = player.position;
            const remainingDistance = Math.abs(position.x - destination.x) + Math.abs(position.y - destination.y);
            
            if (remainingDistance < 1.0) {
              // Close to destination, allow new movement
              allowedLimit = 1;
              console.log(`Player ${entityId} close to destination (${remainingDistance.toFixed(2)} tiles), allowing new movement`);
            } else {
              allowedLimit = 0; // Still restrict while not near destination
              console.log(`🚫 GAME THROTTLING: Moving player ${entityId} not close to destination yet (${remainingDistance.toFixed(2)} tiles)`);
            }
          }
        }
        
        // If over the limit, skip processing entirely
        if (currentCount >= allowedLimit) {
          console.log(`🚫 GAME THROTTLING: ${name} input for ${entityId}, count=${currentCount}/${allowedLimit}`);
          return null;
        }
        
        // Increment the count for this step
        this.lastInputCounts.set(inputKey, currentCount + 1);
        console.log(`Game tracking input ${inputKey}: count=${currentCount + 1}/${allowedLimit}`);
      }
      
      // Process the input
      const result = handler(this, now, args as any);
      return result;
    } catch (error) {
      console.error(`Error processing input ${name}:`, error);
      // Return a non-null value to avoid input being discarded
      return { error: true, message: String(error) };
    }
  }
  
  // Generate a key for rate limiting based on input type and arguments
  private getInputRateLimitKey(name: string, args: any): string | null {
    if (!args) return null;
    
    if (name === 'finishDoSomething' && args.agentId) {
      return `${name}:${args.agentId}`;
    }
    
    if (name.includes('agent') && args.agentId) {
      return `${name}:${args.agentId}`;
    }
    
    if (name.startsWith('update') && args.id) {
      return `${name}:${args.id}`;
    }
    
    return null;
  }

  beginStep(now: number) {
    // Store the current location of all players in the history tracking buffer.
    this.historicalLocations.clear();
    for (const player of this.world.players.values()) {
      this.historicalLocations.set(
        player.id,
        new HistoricalObject(locationFields, playerLocation(player)),
      );
    }
    
    // Reset counters at the start of each step
    this.numPathfinds = 0;
    this.lastInputCounts.clear();
    
    // Log step start with timestamp
    console.log(`Beginning new game step at ${now}. Resetting input counters.`);
  }

  tick(now: number) {
    for (const player of this.world.players.values()) {
      player.tick(this, now);
    }
    for (const player of this.world.players.values()) {
      player.tickPathfinding(this, now);
    }
    for (const player of this.world.players.values()) {
      player.tickPosition(this, now);
    }
    for (const conversation of this.world.conversations.values()) {
      conversation.tick(this, now);
    }
    
    // Agent ticks - this is where agent logic including energy updates might happen
    for (const agent of this.world.agents.values()) {
      agent.tick(this, now);
    }

    // *** NEW: Update Player energy from AgentDescription ***
    for (const agent of this.world.agents.values()) {
      const agentDesc = this.agentDescriptions.get(agent.id);
      const player = this.world.players.get(agent.playerId);
      if (agentDesc && player) {
        // Update player's energy. Default to 0 if not set on agentDesc.
        player.energy = agentDesc.energy ?? 0; 
      }
    }
    // *** END NEW ***

    // Save each player's location into the history buffer at the end of
    // each tick.
    for (const player of this.world.players.values()) {
      let historicalObject = this.historicalLocations.get(player.id);
      if (!historicalObject) {
        historicalObject = new HistoricalObject(locationFields, playerLocation(player));
        this.historicalLocations.set(player.id, historicalObject);
      }
      historicalObject.update(now, playerLocation(player));
    }
  }

  async saveStep(ctx: ActionCtx, engineUpdate: EngineUpdate): Promise<void> {
    const diff = this.takeDiff();
    await ctx.runMutation(internal.aiTown.game.saveWorld, {
      engineId: this.engine._id,
      engineUpdate,
      worldId: this.worldId,
      worldDiff: diff,
    });
  }

  takeDiff(): GameStateDiff {
    const historicalLocations = [];
    let bufferSize = 0;
    for (const [id, historicalObject] of this.historicalLocations.entries()) {
      const buffer = historicalObject.pack();
      if (!buffer) {
        continue;
      }
      historicalLocations.push({ playerId: id, location: buffer });
      bufferSize += buffer.byteLength;
    }
    // if (bufferSize > 0) {
    //   console.debug(
    //     `Packed ${Object.entries(historicalLocations).length} history buffers in ${(
    //       bufferSize / 1024
    //     ).toFixed(2)}KiB.`,
    //   );
    // }
    this.historicalLocations.clear();

    const result: GameStateDiff = {
      world: { ...this.world.serialize(), historicalLocations },
      agentOperations: this.pendingOperations,
    };
    this.pendingOperations = [];
    if (this.descriptionsModified) {
      result.playerDescriptions = serializeMap(this.playerDescriptions);
      result.agentDescriptions = serializeMap(this.agentDescriptions);
      result.worldMap = this.worldMap.serialize();
      this.descriptionsModified = false;
    }
    return result;
  }

  static async saveDiff(ctx: MutationCtx, worldId: Id<'worlds'>, diff: GameStateDiff) {
    const existingWorld = await ctx.db.get(worldId);
    if (!existingWorld) {
      throw new Error(`No world found with id ${worldId}`);
    }
    const newWorld = diff.world;
    // Archive newly deleted players, conversations, and agents.
    for (const player of existingWorld.players) {
      if (!newWorld.players.some((p) => p.id === player.id)) {
        await ctx.db.insert('archivedPlayers', { worldId, ...player });
      }
    }
    for (const conversation of existingWorld.conversations) {
      if (!newWorld.conversations.some((c) => c.id === conversation.id)) {
        const participants = conversation.participants.map((p) => p.playerId);
        const endedTimestamp = Date.now(); // Use a consistent timestamp for archiving
        
        // Archive conversation details
        const archivedConversation = {
          worldId,
          id: conversation.id,
          created: conversation.created,
          creator: conversation.creator,
          ended: endedTimestamp,
          lastMessage: conversation.lastMessage,
          numMessages: conversation.numMessages,
          participants,
        };
        await ctx.db.insert('archivedConversations', archivedConversation);

        // *** Corrected: Get agents from the *newWorld* state, not a direct DB query ***
        // We assume newWorld.agents holds the current agent state including playerId
        const agentPlayerIds = new Map<string, string>();
        for (const agent of newWorld.agents) {
          agentPlayerIds.set(agent.playerId, agent.id); 
        }
        // *** End Correction ***

        for (const playerId of participants) {
          const agentId = agentPlayerIds.get(playerId);
          if (agentId) {
            // This participant is an agent, update their description
            const agentDesc = await ctx.db
              .query('agentDescriptions')
              .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('agentId', agentId as GameId<'agents'>)) // Cast agentId
              .unique();
            if (agentDesc) {
              await ctx.db.patch(agentDesc._id, { lastConversationTimestamp: endedTimestamp });
            } else {
              console.warn(`Agent description not found for agentId ${agentId} during conversation archival.`);
            }
          }
        }

        // Insert participatedTogether entries
        for (let i = 0; i < participants.length; i++) {
          for (let j = 0; j < participants.length; j++) {
            if (i == j) {
              continue;
            }
            const player1 = participants[i];
            const player2 = participants[j];
            await ctx.db.insert('participatedTogether', {
              worldId,
              conversationId: conversation.id,
              player1,
              player2,
              ended: endedTimestamp, // Use consistent timestamp
            });
          }
        }
      }
    }
    for (const conversation of existingWorld.agents) {
      if (!newWorld.agents.some((a) => a.id === conversation.id)) {
        await ctx.db.insert('archivedAgents', { worldId, ...conversation });
      }
    }
    // Update the world state.
    await ctx.db.replace(worldId, newWorld);

    // Update the larger description tables if they changed.
    const { playerDescriptions, agentDescriptions, worldMap } = diff;
    if (playerDescriptions) {
      for (const description of playerDescriptions) {
        const existing = await ctx.db
          .query('playerDescriptions')
          .withIndex('worldId', (q) =>
            q.eq('worldId', worldId).eq('playerId', description.playerId),
          )
          .unique();
        if (existing) {
          await ctx.db.replace(existing._id, { worldId, ...description });
        } else {
          await ctx.db.insert('playerDescriptions', { worldId, ...description });
        }
      }
    }
    if (agentDescriptions) {
      for (const description of agentDescriptions) {
        const existing = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('agentId', description.agentId))
          .unique();
        if (existing) {
          await ctx.db.replace(existing._id, { worldId, ...description });
        } else {
          await ctx.db.insert('agentDescriptions', { worldId, ...description });
        }
      }
    }
    if (worldMap) {
      const existing = await ctx.db
        .query('maps')
        .withIndex('worldId', (q) => q.eq('worldId', worldId))
        .unique();
      if (existing) {
        await ctx.db.replace(existing._id, { worldId, ...worldMap });
      } else {
        await ctx.db.insert('maps', { worldId, ...worldMap });
      }
    }
    // Start the desired agent operations.
    for (const operation of diff.agentOperations) {
      await runAgentOperation(ctx, operation.name, operation.args);
    }
  }
}

export const loadWorld = internalQuery({
  args: {
    worldId: v.id('worlds'),
    generationNumber: v.number(),
  },
  handler: async (ctx, args) => {
    return await Game.load(ctx.db, args.worldId, args.generationNumber);
  },
});

export const saveWorld = internalMutation({
  args: {
    engineId: v.id('engines'),
    engineUpdate,
    worldId: v.id('worlds'),
    worldDiff: gameStateDiff,
  },
  handler: async (ctx, args) => {
    await applyEngineUpdate(ctx, args.engineId, args.engineUpdate);
    await Game.saveDiff(ctx, args.worldId, args.worldDiff);
  },
});

export const getFirstMap = internalQuery({
  handler: async (ctx) => {
    const maps = await ctx.db.query("maps").take(1);
    return maps[0];
  },
});

// Query to get world data
export const getWorld = internalQuery({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.worldId);
  },
});

// Query to get player descriptions
export const getPlayerDescriptions = internalQuery({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
  },
});

// Query to get agent descriptions
export const getAgentDescriptions = internalQuery({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
  },
});

// Query to get agent descriptions with sorting options
export const getAllAgents = internalQuery({
  args: {
    worldId: v.id('worlds'),
    sortBy: v.optional(v.union(
      v.literal('name'),
      v.literal('inferences'),
      v.literal('tips'),
    )),
  },
  handler: async (ctx, args) => {
    // Run parallel queries to fetch data
    const [agentDescriptions, world, allPlayerDescriptions] = await Promise.all([
      // Get all agent descriptions
      ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', q => q.eq('worldId', args.worldId))
        .collect(),
      
      // Get world data
      ctx.db.get(args.worldId),
      
      // Get all player descriptions at once instead of individual queries
      ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', q => q.eq('worldId', args.worldId))
        .collect()
    ]);
    
    if (!world) {
      return [];
    }
    
    // Retrieve all agent and player information from world data
    const agents = world.agents || [];
    
    // Create mappings once (faster lookups)
    const agentPlayerMap = new Map();
    for (const agent of agents) {
      agentPlayerMap.set(agent.id, agent.playerId);
    }
    
    // Create player info map from batch query results
    const playerInfoMap = new Map();
    for (const playerDesc of allPlayerDescriptions) {
      playerInfoMap.set(playerDesc.playerId, { 
        name: playerDesc.name, 
        description: playerDesc.description 
      });
    }
    
    // Merge data
    const agentsWithInfo = agentDescriptions.map(agent => {
      const playerId = agentPlayerMap.get(agent.agentId);
      const playerInfo = playerId ? playerInfoMap.get(playerId) : undefined;
      const name = playerInfo?.name || 'Unknown';
      const description = playerInfo?.description || '';
      const energy = agent.energy ?? 100;
      
      return {
        agentId: agent.agentId,
        playerId: playerId || null,
        name,
        description,
        energy,
        inferences: agent.inferences || 0,
        tips: agent.tips || 0,
        avatarUrl: agent.avatarUrl || `https://worlf-fun.s3.ap-northeast-1.amazonaws.com/world.fun/${Math.floor(Math.random() * 30) + 1}.png`,
        isFavorited: agent.favoriteCount ?? 0,
        walletAddress: agent.walletAddress || null,
        userWalletAddress: agent.userWalletAddress || null,
        status: agent.status || generateDefaultStatus(name, agent.identity || ""),
        events: agent.events || generateDefaultEvents(agent.identity || "")
      };
    });
    
    // Sort based on the sorting parameter
    if (args.sortBy) {
      switch (args.sortBy) {
        case 'name':
          agentsWithInfo.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'inferences':
          agentsWithInfo.sort((a, b) => b.inferences - a.inferences);
          break;
        case 'tips':
          agentsWithInfo.sort((a, b) => b.tips - a.tips);
          break;
      }
    }
    
    return agentsWithInfo;
  },
});

// Public query function for HTTP access
export const getAllAgentsPublic = query({
  args: {
    worldId: v.id('worlds'),
    sortBy: v.optional(v.union(
      v.literal('name'),
      v.literal('inferences'),
      v.literal('tips'),
    )),
  },
  handler: async (ctx, args): Promise<Array<{
    agentId: string;
    name: string;
    energy: number;
    inferences: number;
    tips: number;
    walletAddress: string | null;
    status?: Array<{ title: string; icon: string }> | { 
      emotion: string; 
      status: string; 
      current_work: string;
      energy_level?: string;
      location?: string;
      mood_trend?: string;
    };
    events?: Array<{ 
      time: string;
      action: string;
      details: string;
    }>;
  }>> => {
    // Simply call the internal query
    const agents = await ctx.runQuery(internal.aiTown.game.getAllAgents, args);
    return agents;
  },
});

// Generate default status and events
function generateDefaultStatus(name: string, description: string) {
  // Default status, similar to generateAgentStatus in agentStatus.ts but simplified
  return [
    { title: 'Current Work', icon: '💻' },
    { title: 'Emotion', icon: '😊' },
    { title: 'Status', icon: '🚶' },
    { title: 'Energy Level', icon: '🔋🔋' },
    { title: 'Location', icon: '🏠' }
  ];
}

// Helper function to generate default daily events
function generateDefaultEvents(description: string) {
  // Default events, similar to generateAgentEvents in agentStatus.ts but simplified
  return [
    { time: '6:00 to 7:00', action: 'Morning routine', details: '🌅' },
    { time: '9:00 to 12:00', action: 'Work', details: '💼' },
    { time: '12:30 to 13:30', action: 'Lunch', details: '🍱' },
    { time: '14:00 to 16:30', action: 'Meetings', details: '👥' },
    { time: '18:30 to 19:30', action: 'Dinner', details: '🍽️' },
    { time: '20:00 to 21:30', action: 'Relaxation', details: '📺' }
  ];
}

// Mutation to set low energy activity
export const setLowEnergyActivity = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Directly update player information from the database
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      return { success: false, error: "World not found" };
    }
    
    // Find the player
    const players = world.players || [];
    const playerIndex = players.findIndex(p => p.id === args.playerId);
    
    if (playerIndex === -1) {
      return { success: false, error: "Player not found" };
    }
    
    // Update player activity
    players[playerIndex].activity = {
      description: 'out of energy',
      emoji: '🪫', // Low battery emoji
      until: Number.MAX_SAFE_INTEGER // Permanently displayed until energy is restored
    };
    
    // Update world data
    await ctx.db.patch(args.worldId, { players });
    
    return { success: true };
  }
});

// Get agent with highest inference count
export const getTopInferenceAgent = internalQuery({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    // Get all agent descriptions
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    if (agentDescriptions.length === 0) {
      return null;
    }
    
    // Get world data
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      return null;
    }
    
    // Create a mapping from agentId to playerId
    const agentPlayerMap = new Map();
    for (const agent of world.agents || []) {
      agentPlayerMap.set(agent.id, agent.playerId);
    }
    
    // Create a mapping from playerId to player name
    const playerNameMap = new Map();
    for (const player of world.players || []) {
      const playerDesc = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', player.id))
        .unique();
      
      if (playerDesc) {
        playerNameMap.set(player.id, playerDesc.name);
      }
    }
    
    // Find agent with highest inference count
    let topAgent = null;
    let maxInferences = -1;
    
    for (const agent of agentDescriptions) {
      const inferences = agent.inferences || 0;
      if (inferences > maxInferences) {
        maxInferences = inferences;
        
        const playerId = agentPlayerMap.get(agent.agentId);
        const name = playerNameMap.get(playerId) || 'Unknown';
        
        topAgent = {
          agentId: agent.agentId,
          name: name,
          inferences: inferences,
          energy: agent.energy || 0,
          avatarUrl: agent.avatarUrl || null,
          identity: agent.identity || null,
          worldName: "AI Town"
        };
      }
    }
    
    return topAgent;
  },
});

// Get agent with most favorites
export const getMostFavoritedAgent = internalQuery({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    // Get all favorited agents
    const favoriteAgents = await ctx.db
      .query("favoriteAgents")
      .collect();
      
    if (favoriteAgents.length === 0) {
      return null;
    }
    
    // Count favorites for each agent
    const favoriteCount = new Map();
    for (const favorite of favoriteAgents) {
      const count = favoriteCount.get(favorite.agentId) || 0;
      favoriteCount.set(favorite.agentId, count + 1);
    }
    
    // Find agent with most favorites
    let mostFavoritedAgentId = null;
    let maxFavorites = -1;
    
    for (const [agentId, count] of favoriteCount.entries()) {
      if (count > maxFavorites) {
        maxFavorites = count;
        mostFavoritedAgentId = agentId;
      }
    }
    
    if (!mostFavoritedAgentId) {
      return null;
    }
    
    // Get agent details
    const agentDesc = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => 
        q.eq('worldId', args.worldId).eq('agentId', mostFavoritedAgentId)
      )
      .unique();
      
    if (!agentDesc) {
      return null;
    }
    
    // Get world data
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      return null;
    }
    
    // Get player info
    let playerId = null;
    for (const agent of world.agents || []) {
      if (agent.id === mostFavoritedAgentId) {
        playerId = agent.playerId;
        break;
      }
    }
    
    let name = 'Unknown';
    if (playerId) {
      const playerDesc = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', playerId))
        .unique();
        
      if (playerDesc) {
        name = playerDesc.name;
      }
    }
    
    return {
      agentId: mostFavoritedAgentId,
      name: name,
      favoriteCount: maxFavorites,
      inferences: agentDesc.inferences || 0,
      energy: agentDesc.energy || 0,
      avatarUrl: agentDesc.avatarUrl || null,
      identity: agentDesc.identity || null,
      worldName: "AI Town"
    };
  },
});

// Get total inferences count across all agents
export const getAgentStats = internalQuery({
  args: {
    worldId: v.id('worlds'),
  },
  // Define explicit return type for the handler
  handler: async (ctx, args): Promise<{
    totalInferences: number;
    liveAgents: number;
    totalAgents: number;
  }> => {
    // Get all agent descriptions
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    
    let totalInferences = 0;
    for (const agent of agentDescriptions) {
      totalInferences += agent.inferences || 0;
    }
    
    const digitalTwins = await ctx.db.query("digitalTwins").collect();
    const digitalTwinCount = digitalTwins.length;
    const liveAgents = 100;
    const totalAgents = liveAgents + digitalTwinCount;

    return {
      totalInferences,
      liveAgents,
      totalAgents,
    };
  },
});

// Public version of getTotalInferences
export const getAgentStatsPublic = query({
    args: {
        worldId: v.id('worlds'),
    },
    // Define matching explicit return type for the handler
    handler: async (ctx, args): Promise<{
      totalInferences: number;
      liveAgents: number;
      totalAgents: number;
    }> => {
        return await ctx.runQuery(internal.aiTown.game.getAgentStats, { 
            worldId: args.worldId 
        });
    },
});

// Public query functions for HTTP access
export const getTopInferenceAgentPublic = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args): Promise<{
    agentId: string;
    name: string;
    inferences: number;
    energy: number;
    avatarUrl: string | null;
    identity: string | null;
    worldName: string;
  } | null> => {
    return await ctx.runQuery(internal.aiTown.game.getTopInferenceAgent, args);
  },
});

export const getMostFavoritedAgentPublic = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args): Promise<{
    agentId: string;
    name: string;
    favoriteCount: number;
    inferences: number;
    energy: number;
    avatarUrl: string | null;
    identity: string | null;
    worldName: string;
  } | null> => {
    return await ctx.runQuery(internal.aiTown.game.getMostFavoritedAgent, args);
  },
});

