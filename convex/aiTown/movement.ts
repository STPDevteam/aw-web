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
    
    const startTime = now;
    const startPos = { ...player.position }; // Clone to avoid reference issues
    
    // Calculate distances and directions
    const dx = destination.x - startPos.x;
    const dy = destination.y - startPos.y;
    const xDistance = Math.abs(dx);
    const yDistance = Math.abs(dy);
    
    // No movement needed if already at destination
    if (xDistance === 0 && yDistance === 0) {
      // Use the player's current facing direction if available, or default to facing right
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
    
    // Calculate movement times
    // Use Manhattan distance (x+y) to match frontend behavior
    const totalDistance = xDistance + yDistance;
    
    // Fixed speed of 0.75 tiles per second 
    // 1000ms / 0.75 = 1333.33ms per tile
    const msPerTile = 1000 / movementSpeed;
    const totalMovementTime = totalDistance * msPerTile;
    
    const path: PathComponent[] = [];
    
    // Handle single-axis movement (horizontal or vertical only)
    if (xDistance === 0 || yDistance === 0) {
      // Direction vector that points in the movement direction
      const directionVector = {
        dx: xDistance > 0 ? 1 : (xDistance < 0 ? -1 : 0),
        dy: yDistance > 0 ? 1 : (yDistance < 0 ? -1 : 0)
      };
      
      // Start facing the direction of movement
      path.push({
        position: { x: startPos.x, y: startPos.y },
        facing: directionVector, // Already valid (either dx or dy is non-zero)
        t: startTime
      });
      
      // End facing the same direction (still facing forward)
      path.push({
        position: { x: destination.x, y: destination.y },
        facing: directionVector, // Same facing direction at destination
        t: startTime + totalMovementTime
      });
    } else {
      // For two-segment movement (X then Y)
      const xMovementTime = (xDistance / totalDistance) * totalMovementTime;
      
      // Initial segment: move along X-axis first
      const xDirectionVector = { dx: Math.sign(dx), dy: 0 };
      path.push({
        position: { x: startPos.x, y: startPos.y },
        facing: xDirectionVector, // Face along X-axis direction
        t: startTime
      });
      
      // Add a point right before the turn to ensure consistency
      // This helps prevent interpolation issues at the corner
      const cornerTime = startTime + xMovementTime - 50; // 50ms before the turn
      if (cornerTime > startTime) { // Only add if there's enough time
        path.push({
          position: {
            x: destination.x - 0.01 * Math.sign(dx), // Slightly before corner
            y: startPos.y
          },
          facing: xDirectionVector, // Still facing X direction
          t: cornerTime
        });
      }
      
      // Intermediate point (corner) - now switch to facing Y direction
      const yDirectionVector = { dx: 0, dy: Math.sign(dy) };
      path.push({
        position: { x: destination.x, y: startPos.y },
        facing: yDirectionVector, // Face along Y-axis direction
        t: startTime + xMovementTime
      });
      
      // Final destination - still facing Y direction
      path.push({
        position: { x: destination.x, y: destination.y },
        facing: yDirectionVector, // Keep facing the Y direction
        t: startTime + totalMovementTime
      });
    }
    
    return { 
      path: compressPath(path),
      newDestination: null
    };
  } catch (e) {
    console.error(`Error in findRoute: ${e}`);
    return null;
  }
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
    
    // No other collision checks
    return null;
  } catch (error) {
    console.error("Error in blockedWithPositions function:", error);
    return 'error checking position';
  }
}
