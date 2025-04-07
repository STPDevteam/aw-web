import { ObjectType, v } from 'convex/values';
import { GameId, parseGameId } from './ids';
import { agentId, conversationId, playerId } from './ids';
import { serializedPlayer } from './player';
import { Game } from './game';
import {
  ACTION_TIMEOUT,
  AWKWARD_CONVERSATION_TIMEOUT,
  COLLISION_THRESHOLD,
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
import { compressPath, distance, manhattanDistance, pointsEqual } from '../util/geometry';
import { MinHeap } from '../util/minheap';
import { Path, PathComponent, Point, Vector } from '../util/types';
import { Player } from './player';
import { WorldMap } from './worldMap';
import { characters, movementSpeed } from '../../data/characters';

type PathCandidate = {
  position: Point;
  facing?: Vector;
  t: number;
  length: number;
  cost: number;
  prev?: PathCandidate;
};

// Global movement controller to prevent excessive pathfinding
const globalMovementController = {
  lastPathfindTime: 0,
  pathfindsInLastSecond: 0,
  maxPathfindsPerSecond: 20, // Doubled from 10 to 20 pathfinds per second
  agentMovementCooldowns: new Map<string, number>(), // Map of agent ID to last movement time
  minimumCooldown: 500, // Further reduced from 1000ms to 500ms (0.5 second)
  lastCleanupTime: 0
};

export function stopPlayer(player: Player) {
  try {
    if (!player) {
      console.error("Tried to stop a non-existent player");
      return;
    }
    
    // Safely delete pathfinding
    if (player.pathfinding) {
      delete player.pathfinding;
    }
    
    // Set speed to 0
    player.speed = 0;
  } catch (error) {
    console.error("Error in stopPlayer function:", error);
  }
}

export function movePlayer(
  game: Game,
  now: number,
  player: Player,
  destination: Point,
  allowInConversation?: boolean,
) {
  try {
    // First, check and clean up the agent cooldowns map periodically
    if (now - globalMovementController.lastCleanupTime > 30000) { // Every 30 seconds
      globalMovementController.lastCleanupTime = now;
      // Remove entries older than 1 minute
      for (const [agentId, lastMovementTime] of globalMovementController.agentMovementCooldowns.entries()) {
        if (now - lastMovementTime > 60000) {
          globalMovementController.agentMovementCooldowns.delete(agentId);
        }
      }
      console.log(`Cleaned up agent movement cooldowns. Tracking ${globalMovementController.agentMovementCooldowns.size} agents.`);
    }
    
    // Reset global pathfinding counter every second
    if (now - globalMovementController.lastPathfindTime > 1000) {
      globalMovementController.lastPathfindTime = now;
      const previousCount = globalMovementController.pathfindsInLastSecond;
      globalMovementController.pathfindsInLastSecond = 0;
      console.log(`Global pathfind counter reset. Previous second had ${previousCount} pathfinds.`);
    }

    // Check global pathfinding limit
    if (globalMovementController.pathfindsInLastSecond >= globalMovementController.maxPathfindsPerSecond) {
      console.log(`🚫 GLOBAL PATHFIND LIMIT REACHED: Blocking movement for ${player.id}`);
      return;
    }
    
    if (Math.floor(destination.x) !== destination.x || Math.floor(destination.y) !== destination.y) {
      throw new Error(`Non-integral destination: ${JSON.stringify(destination)}`);
    }
    const { position } = player;
    
    // Calculate Manhattan distance to avoid unnecessary movement
    const distanceToDestination = Math.abs(position.x - destination.x) + Math.abs(position.y - destination.y);
    
    // Skip extremely tiny movements
    if (distanceToDestination < 0.1) {
      console.log(`Skipping tiny movement for ${player.id}, distance too small: ${distanceToDestination}`);
      return;
    }
    
    // Don't send movement commands to positions that are nearly identical
    if (pointsEqual(position, destination)) {
      console.log(`Skipping duplicate movement for ${player.id} to same position`);
      return;
    }
    
    // Don't allow players in a conversation to move
    const inConversation = [...game.world.conversations.values()].some(
      (c) => c.participants.get(player.id)?.status.kind === 'participating',
    );
    if (inConversation && !allowInConversation) {
      console.log(`Player ${player.id} can't move while in conversation`);
      throw new Error(`Can't move when in a conversation. Leave the conversation first!`);
    }
    
    // Check if this player belongs to an agent
    let agent = null;
    for (const a of game.world.agents.values()) {
      if (a.playerId === player.id) {
        agent = a;
        break;
      }
    }
    
    // *** EXTREME THROTTLING FOR AGENT MOVEMENT ***
    if (agent) {
      console.log(`MOVEMENT REQUEST: Agent ${player.id} trying to move to (${destination.x},${destination.y})`);
      
      // Check agent-specific cooldown
      const lastMovementTime = globalMovementController.agentMovementCooldowns.get(agent.id);
      if (lastMovementTime) {
        const timeSinceLastMovement = now - lastMovementTime;
        
        // Scale cooldown based on distance - even shorter cooldowns
        let requiredCooldown = globalMovementController.minimumCooldown;
        
        // For farther distances, enforce minimal cooldowns
        if (distanceToDestination > 15) {
          requiredCooldown = 1000; // Further reduced from 2000ms to 1000ms (1 second)
        } else if (distanceToDestination > 8) {
          requiredCooldown = 800; // Further reduced from 1500ms to 800ms (0.8 seconds)
        } else if (distanceToDestination > 4) {
          requiredCooldown = 500; // Further reduced from 1000ms to 500ms (0.5 seconds)
        }
        
        // Apply cooldown check
        if (timeSinceLastMovement < requiredCooldown) {
          console.log(`🚫 EXTREME THROTTLING: Agent ${agent.id} must wait ${(requiredCooldown - timeSinceLastMovement) / 1000}s more before next movement.`);
          return;
        }
      }
      
      // Always check if player has existing pathfinding
      if (player.pathfinding) {
        // Get current destination and how far we've progressed
        const currentDest = player.pathfinding.destination;
        const remainingDistance = Math.abs(position.x - currentDest.x) + Math.abs(position.y - currentDest.y);
        
        // Check if agent is still in "moving" state
        const isCurrentlyMoving = player.pathfinding.state.kind === 'moving';
        
        // If agent is already moving and hasn't reached the destination yet (within 0.1 tiles)
        // then completely block any new movement inputs
        if (remainingDistance > 0.1 || isCurrentlyMoving) {
          console.log(`🚫 BLOCKING: Agent ${player.id} is still moving to (${currentDest.x},${currentDest.y}). Remaining distance: ${remainingDistance.toFixed(2)}. State: ${player.pathfinding.state.kind}`);
          return;
        }
        
        // Even when movement is nearly complete, add mandatory cooldown
        if (agent.lastPathUpdate && now - agent.lastPathUpdate < 800) {
          console.log(`🚫 BLOCKING: Agent ${player.id} movement in cooldown period. Time since last update: ${now - agent.lastPathUpdate}ms`);
          return;
        }
        
        // If we're here, agent has nearly reached its destination, so we can allow a new movement
        console.log(`✅ ALLOWING: Agent ${player.id} has completed previous movement. Allowing new movement to (${destination.x},${destination.y})`);
      } else {
        console.log(`✅ ALLOWING: Agent ${player.id} has no ongoing pathfinding, allowing movement to (${destination.x},${destination.y})`);
      }
      
      // Update the global movement cache with this agent's movement time
      globalMovementController.agentMovementCooldowns.set(agent.id, now);
      
      // Increment the global pathfinding counter
      globalMovementController.pathfindsInLastSecond++;
      
      // Update the last movement timestamp
      agent.lastPathUpdate = now;
      console.log(`✅ TIMESTAMP: Updated agent ${player.id} lastPathUpdate to ${now}`);
      
      // For agents, prefer longer paths to reduce movement frequency
      // If the destination is close, try to find a farther point in the same direction
      if (distanceToDestination < 3 && Math.random() < 0.7) {
        // Calculate direction vector
        const dx = destination.x - position.x;
        const dy = destination.y - position.y;
        
        // Normalize and extend to a farther point (2-5x the distance)
        const multiplier = 2 + Math.floor(Math.random() * 3);
        const farX = position.x + Math.round(dx * multiplier);
        const farY = position.y + Math.round(dy * multiplier);
        
        // Ensure the farther point is within map bounds
        const boundedX = Math.max(0, Math.min(game.worldMap.width - 1, farX));
        const boundedY = Math.max(0, Math.min(game.worldMap.height - 1, farY));
        
        // Only use the farther point if it's different from the original
        if (boundedX !== destination.x || boundedY !== destination.y) {
          const farPoint = { x: boundedX, y: boundedY };
          
          // Check if the farther point is accessible
          if (!blocked(game, now, farPoint, player.id)) {
            console.log(`✅ EXTENDING: Agent ${player.id} movement from (${destination.x},${destination.y}) to farther point (${boundedX},${boundedY})`);
            destination = farPoint;
          }
        }
      }
    }
    
    // Set up new pathfinding operation
    player.pathfinding = {
      destination: destination,
      started: now,
      state: {
        kind: 'needsPath',
      },
    };
    
    console.log(`✅ PATHFINDING: Started new movement for ${player.id} to (${destination.x},${destination.y}), distance: ${distanceToDestination.toFixed(2)}`);
    return;
  } catch (error) {
    console.error(`❌ ERROR in movePlayer for ${player?.id || 'unknown player'}:`, error);
    return;
  }
}

// Helper function to ensure we never have a zero vector for facing direction
function ensureValidFacingVector(vector: Vector): Vector {
  if (vector.dx === 0 && vector.dy === 0) {
    // Default to facing right if vector is zero
    return { dx: 1, dy: 0 };
  }
  return vector;
}

export function findRoute(game: Game, now: number, player: Player, destination: Point) {
  try {
    // First, validate destination is within map boundaries
    if (destination.x < 0 || destination.y < 0 || 
        destination.x >= game.worldMap.width || 
        destination.y >= game.worldMap.height) {
      console.warn(`Destination out of bounds: ${JSON.stringify(destination)}`);
      return null;
    }
    
    // Check if the destination position is blocked
    if (blocked(game, now, destination, player.id)) {
      console.log(`Destination is blocked: ${JSON.stringify(destination)}`);
      return null;
    }
    
    // Check if agent-controlled
    let isAgentPlayer = false;
    for (const agent of game.world.agents.values()) {
      if (agent.playerId === player.id) {
        isAgentPlayer = true;
        break;
      }
    }
    
    // If this is an agent player, apply extreme throttling
    if (isAgentPlayer) {
      // Increment global counter
      globalMovementController.pathfindsInLastSecond++;
      
      // If we've done too many pathfinds in this step, defer until the next step
      if (globalMovementController.pathfindsInLastSecond > globalMovementController.maxPathfindsPerSecond) {
        console.log(`🚫 THROTTLING: Too many pathfinds (${globalMovementController.pathfindsInLastSecond}) in this second, deferring for ${player.id}`);
        return null;
      }
    }
    
    // Track pathfinding operations to avoid system overload
    game.numPathfinds++;
    
    // If we've done too many pathfinds in this step, defer until the next step
    if (game.numPathfinds > 10) { // Lower limit further to reduce database pressure
      console.log(`Too many pathfinds (${game.numPathfinds}) in this step, deferring for ${player.id}`);
      return null;
    }
    
    // Update the agent's lastPathUpdate timestamp
    for (const agent of game.world.agents.values()) {
      if (agent.playerId === player.id) {
        agent.lastPathUpdate = now;
        break;
      }
    }
    
    const startPos = { ...player.position }; // Clone to avoid reference issues
    
    // For very short distance moves (5 tiles or less), try direct path first
    const distance = Math.abs(startPos.x - destination.x) + Math.abs(startPos.y - destination.y);
    if (distance <= 5) {
      const directPath = findDirectPath(game, now, player, destination);
      if (directPath) {
        return directPath;
      }
    }
    
    // For anything else, use A* pathfinding
    return findPathAStar(game, now, player, destination);
  } catch (e) {
    console.error(`Error in findRoute: ${e}`);
    return null;
  }
}

// Find a direct path if there are no obstacles
function findDirectPath(game: Game, now: number, player: Player, destination: Point) {
  const startPos = { ...player.position };
  const startTime = now;
  
  // Calculate distance and direction
  const dx = destination.x - startPos.x;
  const dy = destination.y - startPos.y;
  const xDistance = Math.abs(dx);
  const yDistance = Math.abs(dy);
  
  // No need to move
  if (xDistance === 0 && yDistance === 0) {
    const currentFacing = player.facing ? ensureValidFacingVector(player.facing) : { dx: 1, dy: 0 };
    return {
      path: compressPath([{
        position: { x: startPos.x, y: startPos.y },
        facing: currentFacing,
        t: startTime
      }]),
      newDestination: null
    };
  }
  
  // Calculate movement time
  // Fixed speed of 0.75 tiles per second 
  // 1000ms / 0.75 = 1333.33ms per tile
  const msPerTile = 1000 / movementSpeed;
  const totalDistance = xDistance + yDistance; // Manhattan distance
  const totalMovementTime = totalDistance * msPerTile;
  
  // Check if there are obstacles in the path
  
  // Move horizontally first, then vertically
  const intermediateX = destination.x;
  const intermediateY = startPos.y;
  
  // Check for obstacles on the horizontal path
  if (xDistance > 0) {
    const xStep = dx > 0 ? 1 : -1;
    for (let x = Math.floor(startPos.x) + xStep; x !== Math.floor(intermediateX) + xStep; x += xStep) {
      if (blocked(game, now, { x, y: startPos.y }, player.id)) {
        return null; // 有障碍物，无法直接移动
      }
    }
  }
  
  // Check for obstacles on the vertical path
  if (yDistance > 0) {
    const yStep = dy > 0 ? 1 : -1;
    for (let y = Math.floor(intermediateY) + yStep; y !== Math.floor(destination.y) + yStep; y += yStep) {
      if (blocked(game, now, { x: intermediateX, y }, player.id)) {
        return null; // 有障碍物，无法直接移动
      }
    }
  }
  
  const pathComponents: PathComponent[] = [];
  
  // Handle single-axis movement (horizontal or vertical)
  if (xDistance === 0 || yDistance === 0) {
    // Direction vector pointing towards movement direction
    const directionVector = {
      dx: xDistance > 0 ? 1 : (xDistance < 0 ? -1 : 0),
      dy: yDistance > 0 ? 1 : (yDistance < 0 ? -1 : 0)
    };
    
    // Start facing movement direction
    pathComponents.push({
      position: { x: startPos.x, y: startPos.y },
      facing: directionVector,
      t: startTime
    });
    
    // End facing the same direction
    pathComponents.push({
      position: { x: destination.x, y: destination.y },
      facing: directionVector,
      t: startTime + totalMovementTime
    });
  } else {
    // For two-segment movement (X first, then Y)
    const xMovementTime = (xDistance / totalDistance) * totalMovementTime;
    
    // Initial segment: move along X-axis first
    const xDirectionVector = { dx: Math.sign(dx), dy: 0 };
    pathComponents.push({
      position: { x: startPos.x, y: startPos.y },
      facing: xDirectionVector,
      t: startTime
    });
    
    // Add a point before turning to ensure consistency
    const cornerTime = startTime + xMovementTime - 50; // Turn 50ms before
    if (cornerTime > startTime) {
      pathComponents.push({
        position: {
          x: destination.x - 0.01 * Math.sign(dx),
          y: startPos.y
        },
        facing: xDirectionVector,
        t: cornerTime
      });
    }
    
    // Middle point (corner) - now switch to facing Y direction
    const yDirectionVector = { dx: 0, dy: Math.sign(dy) };
    pathComponents.push({
      position: { x: destination.x, y: startPos.y },
      facing: yDirectionVector,
      t: startTime + xMovementTime
    });
    
    // Final destination - still facing Y direction
    pathComponents.push({
      position: { x: destination.x, y: destination.y },
      facing: yDirectionVector,
      t: startTime + totalMovementTime
    });
  }
  
  return { 
    path: compressPath(pathComponents),
    newDestination: null
  };
}

// A* pathfinding algorithm
function findPathAStar(game: Game, now: number, player: Player, destination: Point): { path: Path, newDestination: null } | null {
  const startPos = { ...player.position };
  const startTime = now;
  
  // Grid positions use integers
  const startX = Math.floor(startPos.x);
  const startY = Math.floor(startPos.y);
  const endX = Math.floor(destination.x);
  const endY = Math.floor(destination.y);
  
  // If start and end points are the same, no pathfinding needed
  if (startX === endX && startY === endY) {
    return {
      path: compressPath([{
        position: startPos,
        facing: player.facing || { dx: 1, dy: 0 },
        t: startTime
      }]),
      newDestination: null
    };
  }
  
  // Heuristic function: Manhattan distance
  const heuristic = (x: number, y: number) => Math.abs(x - endX) + Math.abs(y - endY);
  
  // Open and closed lists
  const openSet = new Set<string>();
  const closedSet = new Set<string>();
  const cameFrom = new Map<string, { x: number, y: number }>();
  
  // G score (cost from start to current point) and F score (G score + heuristic estimate)
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  
  // Initialize start point
  const startKey = `${startX},${startY}`;
  openSet.add(startKey);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(startX, startY));
  
  // Main loop
  while (openSet.size > 0) {
    // Find the node with the lowest F score
    let currentKey = '';
    let lowestFScore = Infinity;
    
    for (const key of openSet) {
      const score = fScore.get(key) || Infinity;
      if (score < lowestFScore) {
        lowestFScore = score;
        currentKey = key;
      }
    }
    
    const [currentX, currentY] = currentKey.split(',').map(Number);
    
    // If we reach the target, rebuild the path
    if (currentX === endX && currentY === endY) {
      // Rebuild the path
      const path = rebuildPath(cameFrom, currentKey, startTime, player);
      return {
        path: compressPath(path),
        newDestination: null
      };
    }
    
    // Remove from openSet, add to closedSet
    openSet.delete(currentKey);
    closedSet.add(currentKey);
    
    // Check four neighbors (up, down, left, right)
    const neighbors = [
      { x: currentX + 1, y: currentY },
      { x: currentX - 1, y: currentY },
      { x: currentX, y: currentY + 1 },
      { x: currentX, y: currentY - 1 }
    ];
    
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      
      // If already evaluated, skip
      if (closedSet.has(neighborKey)) continue;
      
      // Check if passable
      const neighborBlocked = blocked(game, now, neighbor, player.id);
      if (neighborBlocked) continue;
      
      // Calculate G score: distance from start to neighbor
      const tentativeGScore = (gScore.get(currentKey) || 0) + 1;
      
      // If neighbor is not in openSet or a better path is found, update information
      if (!openSet.has(neighborKey) || tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
        cameFrom.set(neighborKey, { x: currentX, y: currentY });
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(neighborKey, tentativeGScore + heuristic(neighbor.x, neighbor.y));
        
        if (!openSet.has(neighborKey)) {
          openSet.add(neighborKey);
        }
      }
    }
  }
  
  // If unable to reach the target, try to find the nearest accessible point
  console.log("No path found to destination, trying to find nearest accessible point");
  return findNearestAccessiblePoint(game, now, player, destination);
}

// Rebuild the path
function rebuildPath(cameFrom: Map<string, { x: number, y: number }>, endKey: string, startTime: number, player: Player): PathComponent[] {
  const path: PathComponent[] = [];
  let currentKey = endKey;
  const waypoints: { x: number, y: number }[] = [];
  
  // Build the list of path points
  while (cameFrom.has(currentKey)) {
    const [x, y] = currentKey.split(',').map(Number);
    waypoints.unshift({ x, y });
    const prev = cameFrom.get(currentKey)!;
    currentKey = `${prev.x},${prev.y}`;
  }
  
  // Add the starting point
  const [startX, startY] = currentKey.split(',').map(Number);
  waypoints.unshift({ x: startX, y: startY });
  
  if (waypoints.length === 0) {
    // If there are no path points, return the current position with valid facing
    return [{
      position: player.position,
      facing: ensureValidFacingVector(player.facing), // Ensure valid facing
      t: startTime
    }];
  }
  
  // Build path components
  const msPerTile = 1000 / movementSpeed;
  let currentTime = startTime;
  let lastValidFacing = ensureValidFacingVector(player.facing); // Start with player's current facing
  
  for (let i = 0; i < waypoints.length; i++) {
    const current = waypoints[i];
    let facing = { dx: 0, dy: 0 };
    
    if (i < waypoints.length - 1) {
      const next = waypoints[i + 1];
      facing.dx = Math.sign(next.x - current.x);
      facing.dy = Math.sign(next.y - current.y);
    } else {
      // Last point uses the previous segment's direction
      facing = lastValidFacing;
    }
    
    // Ensure facing vector is valid and non-zero
    facing = ensureValidFacingVector(facing);
    
    // If the new facing is valid, update the last known valid facing
    if (facing.dx !== 0 || facing.dy !== 0) {
        lastValidFacing = facing;
    }
    
    path.push({
      position: current,
      facing: lastValidFacing, // Always use the last known valid facing
      t: currentTime
    });
    
    // Update time (if not the last point)
    if (i < waypoints.length - 1) {
      const next = waypoints[i + 1];
      const distance = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
      currentTime += distance * msPerTile;
    }
  }
  
  return path;
}

// Find the nearest accessible point to the target
function findNearestAccessiblePoint(game: Game, now: number, player: Player, destination: Point): { path: Path, newDestination: null } | null {
  const maxRadius = 5; // Maximum search radius
  const startX = Math.floor(destination.x);
  const startY = Math.floor(destination.y);
  
  // Candidate points sorted by distance
  const candidates: { x: number, y: number, distance: number }[] = [];
  
  // Search for accessible points around the target
  for (let r = 1; r <= maxRadius; r++) {
    // Check the rectangular boundary around the target
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        // Only check points on the current 'layer' (Manhattan distance equals r)
        if (Math.abs(dx) + Math.abs(dy) !== r) continue;
        
        const x = startX + dx;
        const y = startY + dy;
        
        // Check if the point is within the map bounds and not blocked
        if (x >= 0 && y >= 0 && x < game.worldMap.width && y < game.worldMap.height) {
          if (!blocked(game, now, { x, y }, player.id)) {
            // Calculate Manhattan distance to the target
            const distance = Math.abs(x - startX) + Math.abs(y - startY);
            candidates.push({ x, y, distance });
          }
        }
      }
    }
    
    // If candidate points are found, use the nearest one
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.distance - b.distance);
      const nearest = candidates[0];
      console.log(`Found nearest accessible point: (${nearest.x}, ${nearest.y})`);
      
      // Use A* pathfinding to this accessible point
      return findPathAStar(game, now, player, nearest);
    }
  }
  
  // If no accessible points are found, just return the current position
  console.log("No accessible points found within search radius");
  return {
    path: compressPath([{
      position: player.position,
      facing: player.facing || { dx: 1, dy: 0 },
      t: now
    }]),
    newDestination: null
  };
}

export function blocked(game: Game, now: number, pos: Point, playerId?: GameId<'players'>) {
  try {
    // Only check for map boundaries
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
      return 'invalid position';
    }
    
    if (pos.x < 0 || pos.y < 0 || 
        pos.x >= game.worldMap.width || 
        pos.y >= game.worldMap.height) {
      return 'out of bounds';
    }
    
    // Check for obstacles on the map
    // objectTiles usually contain collidable objects
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    
    // Check all map layers for obstacles
    for (let layerIndex = 0; layerIndex < game.worldMap.objectTiles.length; layerIndex++) {
      const layer = game.worldMap.objectTiles[layerIndex];
      // Check if there's a tile at this position, tile index >= 0 indicates an obstacle
      if (layer[x] && layer[x][y] >= 0) {
        return 'blocked by object';
      }
    }
    
    // Check for overlap with other players
    for (const otherPlayer of game.world.players.values()) {
      if (playerId && otherPlayer.id === playerId) {
        continue; // Skip self
      }
      
      // Use Manhattan distance detection to match frontend implementation
      const otherX = Math.floor(otherPlayer.position.x);
      const otherY = Math.floor(otherPlayer.position.y);
      if (otherX === x && otherY === y) {
        return 'blocked by player';
      }
    }
    
    // No other collision checks
    return null;
  } catch (error) {
    console.error("Error in blocked function:", error);
    return 'error checking position';
  }
}

export function blockedWithPositions(position: Point, otherPositions: Point[], map: WorldMap) {
  try {
    // Validate input
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      return 'invalid position';
    }
    
    // Only check for map boundaries
    if (position.x < 0 || position.y < 0 || 
        position.x >= map.width || 
        position.y >= map.height) {
      return 'out of bounds';
    }
    
    // Check for obstacles on the map
    // objectTiles usually contain collidable objects
    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    
    // Check all map layers for obstacles
    for (let layerIndex = 0; layerIndex < map.objectTiles.length; layerIndex++) {
      const layer = map.objectTiles[layerIndex];
      // Check if there's a tile at this position, tile index >= 0 indicates an obstacle
      if (layer[x] && layer[x][y] >= 0) {
        return 'blocked by object';
      }
    }
    
    // Check for overlap with other given positions
    for (const otherPos of otherPositions) {
      const otherX = Math.floor(otherPos.x);
      const otherY = Math.floor(otherPos.y);
      if (otherX === x && otherY === y) {
        return 'blocked by other position';
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error in blockedWithPositions function:", error);
    return 'error checking position';
  }
}

// Estimate how far along a path we are based on the current time
function estimatePathProgress(path: PathComponent[], now: number): number {
  if (!path || path.length < 2) return 1.0; // No path or single point = 100% done
  
  // Get start and end times from the path
  const startTime = path[0].t;
  const endTime = path[path.length - 1].t;
  
  // Calculate how far along the time range we are
  const totalDuration = endTime - startTime;
  if (totalDuration <= 0) return 1.0; // Avoid division by zero
  
  // Bound progress between 0 and 1
  return Math.min(1.0, Math.max(0.0, (now - startTime) / totalDuration));
}
