// deterministicDestination.ts - Provides destination generation ensuring consistent positions
// with entropy based on agent ID and sequence hash

import { Point } from '../util/types';
import { WorldMap } from './worldMap';

// Map of pre-generated destinations by agent ID
// This provides a strongly stable reference for destinations
const agentDestinationCache = new Map<string, Map<number, Point>>();

/**
 * Generate a deterministic destination based on agent ID and sequence number
 * This ensures that repeated calls with the same agent ID and sequence will
 * produce identical coordinates, preventing stuttering movement
 */
export function generateDeterministicDestination(
  map: WorldMap, 
  agentId: string, 
  sequenceNumber: number,
  forceNewDestination: boolean = false
): Point {
  // Extract agent number from ID (e.g., "a:123" -> 123)
  const agentNumeric = parseInt(agentId.replace(/\D/g, ''), 10) || 0;
  
  // Check if we already have a cached destination for this agent and sequence
  if (!forceNewDestination) {
    // Get or create agent's destination map
    let agentMap = agentDestinationCache.get(agentId);
    if (!agentMap) {
      agentMap = new Map<number, Point>();
      agentDestinationCache.set(agentId, agentMap);
    }
    
    // If we have a cached destination for this sequence, return it
    const cachedDest = agentMap.get(sequenceNumber);
    if (cachedDest) {
      return cachedDest;
    }
  }
  
  // Fixed safety margin from map edges
  const margin = 2;
  const safeWidth = map.width - (2 * margin);
  const safeHeight = map.height - (2 * margin);
  
  // Create a new deterministic destination
  // Use basic linear congruential generator for determinism
  const seed = (agentNumeric * 1000000) + sequenceNumber;
  
  // LCG parameters (commonly used values)
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  
  // Generate first random value
  let rnd = (a * seed + c) % m;
  
  // Use the random value to determine x-coordinate
  const x = margin + Math.floor((rnd / m) * safeWidth);
  
  // Generate second random value
  rnd = (a * rnd + c) % m;
  
  // Use the second random value to determine y-coordinate
  const y = margin + Math.floor((rnd / m) * safeHeight);
  
  // Create the destination point
  const destination = { x, y };
  
  // Cache the destination for this agent and sequence
  const agentMap = agentDestinationCache.get(agentId) || new Map<number, Point>();
  agentMap.set(sequenceNumber, destination);
  agentDestinationCache.set(agentId, agentMap);
  
  // Log the generated destination
  console.log(`Generated destination for agent ${agentId} (sequence ${sequenceNumber}): (${x}, ${y})`);
  
  return destination;
}

/**
 * Prune old entries from the destination cache
 * Called periodically to prevent memory leaks
 */
export function cleanDestinationCache(): void {
  // Get all agent IDs
  const agentIds = Array.from(agentDestinationCache.keys());
  
  // If we have too many agents (more than 200), remove half
  if (agentIds.length > 200) {
    // Sort by agent ID to ensure deterministic cleanup
    agentIds.sort();
    
    // Remove the oldest half
    for (let i = 0; i < agentIds.length / 2; i++) {
      agentDestinationCache.delete(agentIds[i]);
    }
  }
  
  // For each remaining agent, limit sequence count
  for (const agentId of agentDestinationCache.keys()) {
    const sequenceMap = agentDestinationCache.get(agentId);
    if (sequenceMap && sequenceMap.size > 20) {
      // Get sequences sorted by number
      const sequences = Array.from(sequenceMap.keys()).sort((a, b) => a - b);
      
      // Keep only the 10 most recent sequences
      for (let i = 0; i < sequences.length - 10; i++) {
        sequenceMap.delete(sequences[i]);
      }
    }
  }
  
  console.log(`Cleaned destination cache, now tracking ${agentDestinationCache.size} agents`);
}

/**
 * Force a specific destination for testing purposes
 */
export function forceDestination(agentId: string, sequenceNumber: number, destination: Point): void {
  let agentMap = agentDestinationCache.get(agentId);
  if (!agentMap) {
    agentMap = new Map<number, Point>();
    agentDestinationCache.set(agentId, agentMap);
  }
  agentMap.set(sequenceNumber, destination);
}

// Create a map of agent to its movement tracking data
export const agentMovementTracker = new Map<string, {
  lastSequence: number;
  lastDestination: Point;
  nextMoveTime: number;
  movementCount: number;
}>();

/**
 * Get the next available sequence number for an agent
 * Ensures sequential operation handling
 */
export function getNextSequenceNumber(agentId: string): number {
  const tracker = agentMovementTracker.get(agentId);
  if (tracker) {
    return tracker.lastSequence + 1;
  }
  return Math.floor(Date.now() / 1000); // Start with current timestamp in seconds
}

/**
 * Update an agent's movement tracking data
 */
export function updateAgentMovementTracker(
  agentId: string, 
  sequence: number, 
  destination: Point, 
  cooldownMs: number
): void {
  agentMovementTracker.set(agentId, {
    lastSequence: sequence,
    lastDestination: destination,
    nextMoveTime: Date.now() + cooldownMs,
    movementCount: (agentMovementTracker.get(agentId)?.movementCount || 0) + 1
  });
}

/**
 * Check if an agent is allowed to move now
 */
export function canAgentMove(agentId: string, now: number = Date.now()): boolean {
  const tracker = agentMovementTracker.get(agentId);
  if (!tracker) return true; // No record, so allowed
  
  return now >= tracker.nextMoveTime;
}

/**
 * Get movement statistics for debugging
 */
export function getMovementStats(): { 
  movedAgents: number; 
  totalMoves: number; 
  mostActiveAgent: string | null;
  mostActiveMoveCount: number;
} {
  let movedAgents = 0;
  let totalMoves = 0;
  let mostActiveAgent: string | null = null;
  let mostActiveMoveCount = 0;
  
  for (const [agentId, data] of agentMovementTracker.entries()) {
    movedAgents++;
    totalMoves += data.movementCount;
    
    if (data.movementCount > mostActiveMoveCount) {
      mostActiveMoveCount = data.movementCount;
      mostActiveAgent = agentId;
    }
  }
  
  return { 
    movedAgents, 
    totalMoves, 
    mostActiveAgent, 
    mostActiveMoveCount 
  };
} 