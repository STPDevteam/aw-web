import { MutationCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { engineInsertInput } from '../engine/abstractGame';
import { InputNames, InputArgs } from './inputs';

// Define types for movement tracking
type Destination = { x: number; y: number };
type MovementCache = { timestamp: number; destination?: Destination; count: number };

// Create a memory cache to track recent movement inputs
const recentMovementInputs = new Map<string, MovementCache>();
// Maximum age of cache entries (milliseconds)
const CACHE_EXPIRY_TIME = 10000; // Increased to 10 seconds for longer tracking

// Enhance the global input tracking to include sequence-based protection
const globalInputCounts = {
  lastResetTime: 0,
  movementCount: 0,
  maxMovementsPerSecond: 25, // Reduced from 50 to 25 to prevent flooding
  // Track movement sequences by agent ID
  agentMovementSequences: new Map<string, { sequence: number, lastUpdateTime: number }>()
};

// Add a constant to ensure we don't accept the same coordinates multiple times

// Cache of last used coordinates by agent
const agentDestinationCache = new Map<string, {
  coordinates: Set<string>; // Coordinates in "x,y" format
  lastUpdateTime: number;
}>();

// Add a global lock system that absolutely prevents multiple commands for the same agent
// This is an extremely strict locking mechanism to force agents to wait before moving again
const globalAgentLocks = new Map<string, number>();
const GLOBAL_LOCK_DURATION = 10000; // 10 seconds - extremely aggressive

// Clean the destination cache to prevent memory leaks
function cleanDestinationCache(now: number) {
  // Clean entries older than 2 minutes
  const expiryTime = 2 * 60 * 1000; // 2 minutes
  
  for (const [agentId, data] of agentDestinationCache.entries()) {
    if (now - data.lastUpdateTime > expiryTime) {
      agentDestinationCache.delete(agentId);
    }
  }
}

export async function insertInput<Name extends InputNames>(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  name: Name,
  args: InputArgs<Name>,
): Promise<Id<'inputs'>> {
  // Early check for movement inputs that should be locked
  const now = Date.now();
  
  // Extract agent ID if this is a movement command
  if (args && typeof args === 'object') {
    const agentId = 'agentId' in args ? String(args.agentId) : null;
    
    if (agentId) {
      // Check if agent is locked for movement commands
      const isMovementInput = (
        name === 'moveTo' || 
        (name === 'finishDoSomething' && 'destination' in args)
      );
      
      if (isMovementInput) {
        // Check if there's a lock on this agent
        const lockExpiry = globalAgentLocks.get(agentId);
        
        if (lockExpiry) {
          // If lock hasn't expired yet, block the input
          if (now < lockExpiry) {
            // Calculate remaining time on lock
            const remainingTime = Math.round((lockExpiry - now) / 1000);
            console.log(`🔒 HARD LOCK: Agent ${agentId} is locked for ${remainingTime}s more`);
            return "0123456789abcdef012345e" as Id<'inputs'>;
          } else {
            // Lock expired, remove it
            globalAgentLocks.delete(agentId);
          }
        }
        
        // Place a new lock on this agent
        globalAgentLocks.set(agentId, now + GLOBAL_LOCK_DURATION);
        console.log(`🔒 NEW LOCK: Agent ${agentId} locked for ${GLOBAL_LOCK_DURATION / 1000}s`);
      }
    }
  }
  
  // Clean up expired locks
  cleanExpiredLocks(now);
  
  // Clean expired cache entries on each call
  for (const [key, data] of recentMovementInputs.entries()) {
    if (now - data.timestamp > CACHE_EXPIRY_TIME) {
      recentMovementInputs.delete(key);
    }
  }
  
  // Also clean destination cache
  cleanDestinationCache(now);
  
  // Reset global rate limiter more frequently
  if (now - globalInputCounts.lastResetTime > 200) {
    globalInputCounts.lastResetTime = now;
    const previousCount = globalInputCounts.movementCount;
    globalInputCounts.movementCount = 0;
    console.log(`Global rate limiter reset. Previous period had ${previousCount} movement inputs.`);
    
    // Clean up old sequence entries (older than 1 minute)
    for (const [agentId, data] of globalInputCounts.agentMovementSequences.entries()) {
      if (now - data.lastUpdateTime > 60000) {
        globalInputCounts.agentMovementSequences.delete(agentId);
      }
    }
  }
  
  // Apply filtering for movement inputs
  const isMovementInput = (
    name === 'moveTo' || 
    (name === 'finishDoSomething' && args !== null && typeof args === 'object' && 'destination' in args)
  );
  
  if (isMovementInput && args !== null && typeof args === 'object') {
    // Apply global rate limiting
    if (globalInputCounts.movementCount >= globalInputCounts.maxMovementsPerSecond) {
      console.log(`🚫 GLOBAL RATE LIMIT EXCEEDED: Count: ${globalInputCounts.movementCount}/${globalInputCounts.maxMovementsPerSecond}`);
      return "0123456789abcdef0123457" as Id<'inputs'>;
    }
    
    // Check if this is a movement input with valid destination
    const hasDestination = 'destination' in args && 
                          args.destination !== null && 
                          typeof args.destination === 'object' &&
                          'x' in args.destination && 
                          'y' in args.destination;
    
    // Get player or agent ID from the args
    const entityId = 'playerId' in args ? args.playerId : 
                     'agentId' in args ? args.agentId : null;
                     
    if (hasDestination && entityId) {
      const cacheKey = `${name}:${entityId}`;
      const typedDestination = args.destination as Destination;
      
      // NEW: Coordinate-based deduplication
      // Get or create the agent's coordinate cache
      let agentCoords = agentDestinationCache.get(entityId as string);
      if (!agentCoords) {
        agentCoords = { coordinates: new Set<string>(), lastUpdateTime: now };
        agentDestinationCache.set(entityId as string, agentCoords);
      }
      
      // Check if these exact coordinates were recently used
      const coordKey = `${Math.round(typedDestination.x)},${Math.round(typedDestination.y)}`;
      if (agentCoords.coordinates.has(coordKey)) {
        console.log(`🚫 DUPLICATE: Agent ${entityId} tried to move to ${coordKey} again, blocking`);
        return "0123456789abcdef012345c" as Id<'inputs'>;
      }
      
      // Add these coordinates to the cache
      agentCoords.coordinates.add(coordKey);
      agentCoords.lastUpdateTime = now;
      
      // Limit the number of cached coordinates to prevent memory issues
      if (agentCoords.coordinates.size > 20) {
        // Convert to array and remove oldest entries
        const coordArray = Array.from(agentCoords.coordinates);
        agentCoords.coordinates = new Set(coordArray.slice(-10)); // Keep only the 10 most recent
      }
      
      // Sequence-based deduplication for the same agent
      // Extract the operationId if available to detect duplicates
      const operationId = 'operationId' in args ? String(args.operationId) : '';
      
      if (operationId && operationId.startsWith('o:')) {
        // Try to extract sequence number from operationId
        const sequenceMatch = operationId.match(/o:(\d+)/);
        if (sequenceMatch && sequenceMatch[1]) {
          const currentSequence = parseInt(sequenceMatch[1], 10);
          
          // Get the last sequence number we processed for this agent
          const agentSequenceData = globalInputCounts.agentMovementSequences.get(entityId as string);
          
          if (agentSequenceData) {
            const { sequence: lastSequence, lastUpdateTime } = agentSequenceData;
            
            // More strict sequence checking:
            // 1. If this sequence is already processed, reject it
            // 2. If it's more than 10 off from the last sequence, also reject it (likely stale)
            const isDuplicate = currentSequence <= lastSequence;
            const isOutOfSequence = currentSequence > lastSequence + 10;
            
            if (isDuplicate) {
              console.log(`🚫 DUPLICATE SEQUENCE: Blocking ${entityId}, sequence ${currentSequence} <= ${lastSequence}`);
              return "0123456789abcdef012345b" as Id<'inputs'>;
            }
            
            if (isOutOfSequence) {
              console.log(`🚫 OUT OF SEQUENCE: Blocking ${entityId}, sequence ${currentSequence} too far ahead of ${lastSequence}`);
              return "0123456789abcdef012345d" as Id<'inputs'>;
            }
          }
          
          // Update the sequence for this agent
          globalInputCounts.agentMovementSequences.set(entityId as string, {
            sequence: currentSequence,
            lastUpdateTime: now
          });
          
        }
      }
      
      // Check cooldown between movements for the same entity
      let recentInput = recentMovementInputs.get(cacheKey);
      if (recentInput) {
        const movementCount = recentInput.count + 1;
        const timeSinceLastMovement = now - recentInput.timestamp;
        
        // Very strict cooldown of 2 seconds between movements
        if (timeSinceLastMovement < 2000) {
          console.log(`🚫 COOLDOWN: Movement cooldown for ${entityId}. Last move ${timeSinceLastMovement}ms ago`);
          return "0123456789abcdef0123458" as Id<'inputs'>;
        }
        
        // Limit on movements in tracking period
        if (movementCount > 20) {
          console.log(`🚫 TOO MANY MOVES: Entity ${entityId} has ${movementCount} movements in period`);
          return "0123456789abcdef0123459" as Id<'inputs'>;
        }
        
        // Block nearby destinations
        if (recentInput.destination) {
          const dx = Math.abs(recentInput.destination.x - typedDestination.x);
          const dy = Math.abs(recentInput.destination.y - typedDestination.y);
          
          // Block if less than 4 tiles away (more strict)
          if (dx + dy < 4) {
            console.log(`🚫 TOO CLOSE: Destination (${typedDestination.x},${typedDestination.y}) too close to previous`);
            return "0123456789abcdef012345a" as Id<'inputs'>;
          }
        }
        
        // Update movement cache
        recentMovementInputs.set(cacheKey, {
          timestamp: now,
          destination: { x: typedDestination.x, y: typedDestination.y },
          count: movementCount
        });
      } else {
        // First movement for this entity
        recentMovementInputs.set(cacheKey, {
          timestamp: now,
          destination: { x: typedDestination.x, y: typedDestination.y },
          count: 1
        });
      }
      
      // Increment global counter
      globalInputCounts.movementCount++;
      
    }
  }
  
  // Process the input with the database
  try {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    
    if (!worldStatus) {
      console.error(`Engine not found: World ID=${worldId}`);
      throw new Error(`World for engine ${worldId} not found`);
    }
    
    console.log(`Engine found: ID=${worldStatus.engineId}, World ID=${worldId}`);
    const result = await engineInsertInput(ctx, worldStatus.engineId, name, args);
    console.log(`Insert successful: ${result}`);
    return result;
  } catch (error) {
    console.error(`Insert failed: World ID=${worldId}, Name=${name}, Error=`, error);
    throw error;
  }
}

function cleanExpiredLocks(now: number): void {
  // Remove all expired locks
  for (const [agentId, expiry] of globalAgentLocks.entries()) {
    if (now > expiry) {
      globalAgentLocks.delete(agentId);
    }
  }
  
  // Limit the size of the lock map to prevent memory issues
  if (globalAgentLocks.size > 200) {
    // Convert to array of entries
    const entries = Array.from(globalAgentLocks.entries());
    
    // Sort by expiry time, oldest first
    entries.sort((a, b) => a[1] - b[1]);
    
    // Create a new map with only the 100 most recent entries
    globalAgentLocks.clear();
    for (let i = entries.length - 100; i < entries.length; i++) {
      globalAgentLocks.set(entries[i][0], entries[i][1]);
    }
  }
}
