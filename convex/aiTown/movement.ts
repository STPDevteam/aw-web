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
  if (Math.floor(destination.x) !== destination.x || Math.floor(destination.y) !== destination.y) {
    throw new Error(`Non-integral destination: ${JSON.stringify(destination)}`);
  }
  const { position } = player;
  
  // Optimization: Calculate Manhattan distance to avoid unnecessary movement
  const distanceToDestination = Math.abs(position.x - destination.x) + Math.abs(position.y - destination.y);
  
  // Skip only extremely tiny movements (less than 0.1 units away)
  if (distanceToDestination < 0.1) {
    return;
  }
  
  // Optimization: Don't send movement commands to positions that are nearly identical
  // Close enough to current position => no-op.
  if (pointsEqual(position, destination)) {
    return;
  }
  
  // Don't allow players in a conversation to move.
  const inConversation = [...game.world.conversations.values()].some(
    (c) => c.participants.get(player.id)?.status.kind === 'participating',
  );
  if (inConversation && !allowInConversation) {
    throw new Error(`Can't move when in a conversation. Leave the conversation first!`);
  }
  
  // Optimization: Check if there's already an active pathfinding operation
  // If it's to the same or very close destination, don't change anything to avoid stuttering
  if (player.pathfinding && player.pathfinding.destination) {
    const currentDest = player.pathfinding.destination;
    
    // If we already have a path to somewhere very close to the requested destination,
    // don't bother creating a new path - but use a smaller threshold to allow more movement
    const distToCurrentDest = Math.abs(currentDest.x - destination.x) + Math.abs(currentDest.y - destination.y);
    if (distToCurrentDest < 0.5) { // Reduced from 2.0 to 0.5
      return;
    }
  }
  
  // Find if this is an agent's player and check the last path update time
  let shouldThrottle = false;
  let agent = null;
  
  // Check if this player belongs to an agent
  for (const a of game.world.agents.values()) {
    if (a.playerId === player.id) {
      agent = a;
      break;
    }
  }
  
  // Throttle path updates for agents to reduce input frequency
  if (agent) {
    // Adaptive throttling based on distance - significantly reduced intervals
    // For close movements: 300ms between updates
    // For medium movements: 500ms between updates
    // For far movements: 800ms between updates
    let minUpdateInterval = 300; // default minimum interval - reduced from 800
    
    if (distanceToDestination > 8) {
      minUpdateInterval = 800; // Far movements - reduced from 2000
    } else if (distanceToDestination > 3) {
      minUpdateInterval = 500; // Medium distance movements - reduced from 1200
    }
    
    const timeSinceLastUpdate = agent.lastPathUpdate ? now - agent.lastPathUpdate : 9999;
    if (timeSinceLastUpdate < minUpdateInterval) {
      // Occasionally let some updates through even during throttling period
      // to ensure agents don't get stuck in place
      if (Math.random() < 0.1) { // 10% chance to bypass throttling
        shouldThrottle = false;
      } else {
        shouldThrottle = true;
      }
    }
  }
  
  // If we're throttling, don't create a new pathfinding operation
  if (shouldThrottle) {
    return;
  }
  
  // Set up new pathfinding operation
  player.pathfinding = {
    destination: destination,
    started: now,
    state: {
      kind: 'needsPath',
    },
  };
  
  // Update the agent's lastPathUpdate timestamp
  if (agent) {
    agent.lastPathUpdate = now;
  }
  
  return;
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
    // First check if the destination point is within the map boundaries
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
    
    // Limit pathfinding operations to avoid overloading the system
    // Increment counter to track pathfinding operations per step
    game.numPathfinds++;
    
    // If we've done too many pathfinds in this step, defer until the next step
    // But use a higher limit to ensure sufficient pathfinding operations are processed
    if (game.numPathfinds > 40) { // Increased from 20 to 40
      console.log(`Too many pathfinds (${game.numPathfinds}) in this step, deferring pathfinding for ${player.id}`);
      return null;
    }
    
    // Update the agent's lastPathUpdate timestamp if this is an agent
    for (const agent of game.world.agents.values()) {
      if (agent.playerId === player.id) {
        agent.lastPathUpdate = now;
        break;
      }
    }
    
    const startTime = now;
    const startPos = { ...player.position }; // Clone to avoid reference issues
    
    // If the direct path has no obstacles, use a simple path
    const directPath = findDirectPath(game, now, player, destination);
    if (directPath) {
      return directPath;
    }
    
    // Otherwise use A* pathfinding algorithm
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
    // If there are no path points, return the current position
    return [{
      position: player.position,
      facing: player.facing || { dx: 1, dy: 0 },
      t: startTime
    }];
  }
  
  // Build path components
  const msPerTile = 1000 / movementSpeed;
  let currentTime = startTime;
  
  for (let i = 0; i < waypoints.length; i++) {
    const current = waypoints[i];
    
    // Determine facing direction
    let facing = { dx: 0, dy: 0 };
    if (i < waypoints.length - 1) {
      const next = waypoints[i + 1];
      facing.dx = Math.sign(next.x - current.x);
      facing.dy = Math.sign(next.y - current.y);
    } else if (i > 0) {
      // Last point uses the previous direction
      const prev = waypoints[i - 1];
      facing.dx = Math.sign(current.x - prev.x);
      facing.dy = Math.sign(current.y - prev.y);
    } else {
      // If there's only one point, use the player's current direction
      facing = player.facing || { dx: 1, dy: 0 };
    }
    
    // Ensure facing vector is valid
    facing = ensureValidFacingVector(facing);
    
    path.push({
      position: current,
      facing,
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
