import { movementSpeed } from '../../data/characters';
import { COLLISION_THRESHOLD } from '../constants';
import { compressPath, distance, manhattanDistance, pointsEqual } from '../util/geometry';
import { MinHeap } from '../util/minheap';
import { Point, Vector } from '../util/types';
import { Game } from './game';
import { GameId } from './ids';
import { Player } from './player';
import { WorldMap } from './worldMap';

// Add pathfinding optimization constants
const MAX_SEARCH_NODES = 1500; // Maximum search nodes, increased from 1000 to 1500
const MAX_SEARCH_DISTANCE = 35; // Maximum search distance, increased from 30 to 35
const EARLY_EXIT_THRESHOLD = 2.5; // Early exit threshold, reduced from 3 to 2.5 to find reasonable paths faster

type PathCandidate = {
  position: Point;
  facing?: Vector;
  t: number;
  length: number;
  cost: number;
  prev?: PathCandidate;
};

// Path cache for storing recently calculated paths
// Key format: "startX,startY-endX,endY"
const pathCache: Map<string, {
  path: any;
  timestamp: number;
  newDestination?: Point;
}> = new Map();

// Cache expiry time (5 minutes)
const CACHE_EXPIRY = 5 * 60 * 1000;

// Clean up expired cache entries
function cleanupPathCache(now: number) {
  for (const [key, value] of pathCache.entries()) {
    if (now - value.timestamp > CACHE_EXPIRY) {
      pathCache.delete(key);
    }
  }
}

export function stopPlayer(player: Player) {
  delete player.pathfinding;
  player.speed = 0;
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
  // Close enough to current position or destination => no-op.
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
  player.pathfinding = {
    destination: destination,
    started: now,
    state: {
      kind: 'needsPath',
    },
  };
  return;
}

export function findRoute(game: Game, now: number, player: Player, destination: Point) {
  // Clean up expired cache entries on each pathfinding request
  cleanupPathCache(now);
  
  const startingLocation = player.position;
  
  // Create cache key
  const cacheKey = `${Math.floor(startingLocation.x)},${Math.floor(startingLocation.y)}-${Math.floor(destination.x)},${Math.floor(destination.y)}`;
  
  // Record pathfinding start
  const startTime = Date.now();
  const isHuman = player.human ? "human" : "NPC";
  console.log(`Starting pathfinding: ${player.id} (${isHuman}), from [${Math.floor(startingLocation.x)},${Math.floor(startingLocation.y)}] to [${Math.floor(destination.x)},${Math.floor(destination.y)}]`);
  
  // Check cache
  const cachedPath = pathCache.get(cacheKey);
  if (cachedPath && (now - cachedPath.timestamp < CACHE_EXPIRY)) {
    // Adjust the time of the cached path to the current time
    const timeDiff = now - cachedPath.timestamp;
    const updatedPath = cachedPath.path.map((component: any) => {
      return {
        ...component,
        t: component.t + timeDiff
      };
    });
    
    const cacheAge = Math.floor((now - cachedPath.timestamp)/1000);
    console.log(`Using cached path: ${cacheKey}, cached ${cacheAge} seconds ago, path length: ${updatedPath.length}`);
    return { 
      path: updatedPath, 
      newDestination: cachedPath.newDestination 
    };
  }
  
  const minDistances: PathCandidate[][] = [];
  let searchedNodes = 0; // Search node count
  
  // Calculate the straight-line distance from the start to the destination
  const directDistance = distance(startingLocation, destination);
  
  // If the destination is too far, try moving towards the destination in a straight line
  let targetDestination = destination;
  if (directDistance > MAX_SEARCH_DISTANCE) {
    const dx = destination.x - startingLocation.x;
    const dy = destination.y - startingLocation.y;
    const norm = Math.sqrt(dx * dx + dy * dy);
    targetDestination = {
      x: Math.floor(startingLocation.x + (dx / norm) * MAX_SEARCH_DISTANCE),
      y: Math.floor(startingLocation.y + (dy / norm) * MAX_SEARCH_DISTANCE),
    };
    console.log(`Destination is too far (${directDistance.toFixed(2)}), redirecting to intermediate point: ${JSON.stringify(targetDestination)}`);
  }
  
  const explore = (current: PathCandidate): Array<PathCandidate> => {
    // Limit the number of search nodes
    if (searchedNodes > MAX_SEARCH_NODES) {
      return [];
    }
    searchedNodes++;
    
    const { x, y } = current.position;
    const neighbors = [];

    // If we're close to the destination, prioritize moving directly to the destination
    if (manhattanDistance(current.position, targetDestination) <= 3) {
      neighbors.push({ 
        position: targetDestination, 
        facing: { 
          dx: Math.sign(targetDestination.x - x), 
          dy: Math.sign(targetDestination.y - y) 
        } 
      });
    }

    // If we're not on a grid point, first try to move horizontally
    // or vertically to a grid point. Note that this can create very small
    // deltas between the current position and the nearest grid point so
    // be careful to preserve the `facing` vectors rather than trying to
    // derive them anew.
    if (x !== Math.floor(x)) {
      neighbors.push(
        { position: { x: Math.floor(x), y }, facing: { dx: -1, dy: 0 } },
        { position: { x: Math.floor(x) + 1, y }, facing: { dx: 1, dy: 0 } },
      );
    }
    if (y !== Math.floor(y)) {
      neighbors.push(
        { position: { x, y: Math.floor(y) }, facing: { dx: 0, dy: -1 } },
        { position: { x, y: Math.floor(y) + 1 }, facing: { dx: 0, dy: 1 } },
      );
    }
    
    // Otherwise, just move to adjacent grid points.
    if (x == Math.floor(x) && y == Math.floor(y)) {
      // Optimize direction: prioritize moving towards the destination
      const dx = Math.sign(targetDestination.x - x);
      const dy = Math.sign(targetDestination.y - y);
      
      // First, add movement towards the destination
      if (dx !== 0) neighbors.push({ position: { x: x + dx, y }, facing: { dx, dy: 0 } });
      if (dy !== 0) neighbors.push({ position: { x, y: y + dy }, facing: { dx: 0, dy } });
      
      // Then, add movement in other directions
      if (dx === 0) {
        neighbors.push({ position: { x: x + 1, y }, facing: { dx: 1, dy: 0 } });
        neighbors.push({ position: { x: x - 1, y }, facing: { dx: -1, dy: 0 } });
      }
      if (dy === 0) {
        neighbors.push({ position: { x, y: y + 1 }, facing: { dx: 0, dy: 1 } });
        neighbors.push({ position: { x, y: y - 1 }, facing: { dx: 0, dy: -1 } });
      }
    }
    
    const next = [];
    for (const { position, facing } of neighbors) {
      // Ignore positions that are out of bounds
      if (position.x < 0 || position.y < 0 || 
          position.x >= game.worldMap.width || position.y >= game.worldMap.height) {
        continue;
      }
      
      const segmentLength = distance(current.position, position);
      const length = current.length + segmentLength;
      
      // If the total path length is already much longer than the straight-line distance, don't consider this path
      if (length > directDistance * EARLY_EXIT_THRESHOLD) {
        continue;
      }
      
      if (blocked(game, now, position, player.id)) {
        continue;
      }
      const remaining = manhattanDistance(position, targetDestination);
      const path = {
        position,
        facing,
        // Movement speed is in tiles per second.
        t: current.t + (segmentLength / movementSpeed) * 1000,
        length,
        cost: length + remaining,
        prev: current,
      };
      const existingMin = minDistances[position.y]?.[position.x];
      if (existingMin && existingMin.cost <= path.cost) {
        continue;
      }
      minDistances[position.y] ??= [];
      minDistances[position.y][position.x] = path;
      next.push(path);
    }
    return next;
  };

  const startingPosition = { x: startingLocation.x, y: startingLocation.y };
  let current: PathCandidate | undefined = {
    position: startingPosition,
    facing: player.facing,
    t: now,
    length: 0,
    cost: manhattanDistance(startingPosition, targetDestination),
    prev: undefined,
  };
  let bestCandidate = current;
  const minheap = MinHeap<PathCandidate>((p0, p1) => p0.cost > p1.cost);
  
  // Add a safety limit to prevent infinite loops
  let iterations = 0;
  const MAX_ITERATIONS = 2000;
  
  while (current && iterations < MAX_ITERATIONS) {
    iterations++;
    
    if (pointsEqual(current.position, targetDestination)) {
      break;
    }
    if (
      manhattanDistance(current.position, targetDestination) <
      manhattanDistance(bestCandidate.position, targetDestination)
    ) {
      bestCandidate = current;
    }
    
    // If the number of search nodes exceeds the limit, use the current best candidate
    if (searchedNodes > MAX_SEARCH_NODES) {
      console.log(`Pathfinding search nodes reached limit (${MAX_SEARCH_NODES}), using best candidate`);
      break;
    }
    
    for (const candidate of explore(current)) {
      minheap.push(candidate);
    }
    current = minheap.pop();
  }
  
  if (iterations >= MAX_ITERATIONS) {
    console.log(`Pathfinding iterations reached limit (${MAX_ITERATIONS}), using best candidate`);
  }
  
  let newDestination = null;
  if (!current) {
    if (bestCandidate.length === 0) {
      return null;
    }
    current = bestCandidate;
    newDestination = current.position;
  }
  
  const densePath = [];
  let facing = current.facing!;
  while (current) {
    densePath.push({ position: current.position, t: current.t, facing });
    facing = current.facing!;
    current = current.prev;
  }
  densePath.reverse();

  // Compress the path to reduce data size
  const compressedPath = compressPath(densePath);
  const endTime = Date.now();
  const timeUsed = endTime - startTime;
  console.log(`Path search completed: ${searchedNodes} nodes, ${iterations} iterations, path length: ${compressedPath.length}, time used: ${timeUsed}ms`);

  // After the result is calculated, store it in the cache
  const result = {
    path: compressedPath,
    newDestination: newDestination === null ? undefined : newDestination
  };
  
  // Only cache the result when pathfinding is successful and the path is not too short
  if (compressedPath.length > 3) {
    pathCache.set(cacheKey, {
      path: compressedPath,
      timestamp: now,
      newDestination: newDestination === null ? undefined : newDestination
    });
    console.log(`Path cached: ${cacheKey}, path length: ${compressedPath.length}`);
  }
  
  return result;
}

export function blocked(game: Game, now: number, pos: Point, playerId?: GameId<'players'>) {
  const otherPositions = [...game.world.players.values()]
    .filter((p) => p.id !== playerId)
    .map((p) => p.position);
  return blockedWithPositions(pos, otherPositions, game.worldMap);
}

export function blockedWithPositions(position: Point, otherPositions: Point[], map: WorldMap) {
  if (isNaN(position.x) || isNaN(position.y)) {
    throw new Error(`NaN position in ${JSON.stringify(position)}`);
  }
  if (position.x < 0 || position.y < 0 || position.x >= map.width || position.y >= map.height) {
    return 'out of bounds';
  }
  for (const layer of map.objectTiles) {
    if (layer[Math.floor(position.x)][Math.floor(position.y)] !== -1) {
      return 'world blocked';
    }
  }
  for (const otherPosition of otherPositions) {
    if (distance(otherPosition, position) < COLLISION_THRESHOLD) {
      return 'player';
    }
  }
  return null;
}
