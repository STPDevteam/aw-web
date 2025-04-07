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

// Modify the global input rate limiter to allow even more movement inputs
const globalInputCounts = {
  lastResetTime: 0,
  movementCount: 0,
  maxMovementsPerSecond: 50, // Increased from 20 to 50 movement inputs per second
};

export async function insertInput<Name extends InputNames>(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  name: Name,
  args: InputArgs<Name>,
): Promise<Id<'inputs'>> {
  console.log(`Inserting input: World ID=${worldId}, Name=${name}, Args=`, JSON.stringify(args).substring(0, 200));
  
  // Clean expired cache entries on each call instead of using setInterval
  const now = Date.now();
  for (const [key, data] of recentMovementInputs.entries()) {
    if (now - data.timestamp > CACHE_EXPIRY_TIME) {
      recentMovementInputs.delete(key);
    }
  }
  
  // Reset global rate limiter more frequently (every 200ms instead of 500ms)
  if (now - globalInputCounts.lastResetTime > 200) {
    globalInputCounts.lastResetTime = now;
    const previousCount = globalInputCounts.movementCount;
    globalInputCounts.movementCount = 0;
    console.log(`Global rate limiter reset. Previous period had ${previousCount} movement inputs.`);
  }
  
  // Apply less strict filtering for movement inputs
  const isMovementInput = (
    name === 'moveTo' || 
    (name === 'finishDoSomething' && args !== null && typeof args === 'object' && 'destination' in args)
  );
  
  if (isMovementInput && args !== null && typeof args === 'object') {
    // Apply global rate limiting for ALL movement inputs, but with higher limit
    if (globalInputCounts.movementCount >= globalInputCounts.maxMovementsPerSecond) {
      console.log(`🚫 GLOBAL RATE LIMIT EXCEEDED: Blocking movement input. Count: ${globalInputCounts.movementCount}/${globalInputCounts.maxMovementsPerSecond}`);
      // Return a fake ID for global rate limit
      return "0123456789abcdef0123457" as Id<'inputs'>;
    }
    
    // Check if this is a movement input (has a destination property)
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
      
      // Check if we recently processed a movement input for this entity
      let recentInput = recentMovementInputs.get(cacheKey);
      
      // If we have a record for this entity
      if (recentInput) {
        // Increase the movement counter for this entity
        const movementCount = recentInput.count + 1;
        const timeSinceLastMovement = now - recentInput.timestamp;
        
        // Short cooldown between movements for the same entity
        if (timeSinceLastMovement < 500) {  // Reduced from 1000ms to 500ms (0.5 second)
          // Allow through 90% of the time even during cooldown
          if (Math.random() < 0.9) { // Increased from 0.5 to 0.9
            console.log(`Allowing movement during cooldown for ${entityId}. Last movement ${timeSinceLastMovement}ms ago`);
          } else {
            console.log(`🚫 BLOCKING: Movement cooldown for ${entityId}. Last movement ${timeSinceLastMovement}ms ago`);
            return "0123456789abcdef0123458" as Id<'inputs'>;
          }
        }
        
        // Higher limit on movements in tracking period
        if (movementCount > 100) {  // Increased from 50 to 100 movements in the tracking period
          console.log(`🚫 BLOCKING: Entity ${entityId} has too many movements (${movementCount}) in tracking period`);
          return "0123456789abcdef0123459" as Id<'inputs'>;
        }
        
        // Only block identical destinations, allow closer movements
        if (recentInput.destination) {
          const dx = Math.abs(recentInput.destination.x - typedDestination.x);
          const dy = Math.abs(recentInput.destination.y - typedDestination.y);
          
          // Only block identical destinations, not nearby ones
          if (dx === 0 && dy === 0) {
            console.log(`🚫 BLOCKING: Identical destination (${typedDestination.x},${typedDestination.y}) for ${entityId}`);
            return "0123456789abcdef012345a" as Id<'inputs'>;
          }
        }
        
        // Update the movement cache with new data
        recentMovementInputs.set(cacheKey, {
          timestamp: now,
          destination: { x: typedDestination.x, y: typedDestination.y },
          count: movementCount
        });
      } else {
        // First movement for this entity in the tracking period
        recentMovementInputs.set(cacheKey, {
          timestamp: now,
          destination: { x: typedDestination.x, y: typedDestination.y },
          count: 1
        });
      }
      
      // Increment the global movement counter
      globalInputCounts.movementCount++;
      
      console.log(`✅ ALLOWING: Movement for ${entityId} to (${typedDestination.x},${typedDestination.y}). Global count: ${globalInputCounts.movementCount}`);
    }
  }
  
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
