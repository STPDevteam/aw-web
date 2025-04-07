import { Infer, ObjectType, v } from 'convex/values';
import { Point, Vector, path, point, vector } from '../util/types';
import { GameId, parseGameId } from './ids';
import { playerId } from './ids';
import {
  PATHFINDING_TIMEOUT,
  PATHFINDING_BACKOFF,
  HUMAN_IDLE_TOO_LONG,
  MAX_HUMAN_PLAYERS,
  MAX_PATHFINDS_PER_STEP,
} from '../constants';
import { pointsEqual, pathPosition, distance } from '../util/geometry';
import { Game } from './game';
import { stopPlayer, findRoute, blocked, movePlayer } from './movement';
import { inputHandler } from './inputHandler';
import { characters } from '../../data/characters';
import { PlayerDescription } from './playerDescription';

const pathfinding = v.object({
  destination: point,
  started: v.number(),
  state: v.union(
    v.object({
      kind: v.literal('needsPath'),
    }),
    v.object({
      kind: v.literal('waiting'),
      until: v.number(),
    }),
    v.object({
      kind: v.literal('moving'),
      path,
    }),
  ),
});
export type Pathfinding = Infer<typeof pathfinding>;

export const activity = v.object({
  description: v.string(),
  emoji: v.optional(v.string()),
  until: v.number(),
});
export type Activity = Infer<typeof activity>;

export const serializedPlayer = {
  id: playerId,
  human: v.optional(v.string()),
  pathfinding: v.optional(pathfinding),
  activity: v.optional(activity),

  // The last time they did something.
  lastInput: v.number(),

  position: point,
  facing: vector,
  speed: v.number(),
};
export type SerializedPlayer = ObjectType<typeof serializedPlayer>;

export class Player {
  id: GameId<'players'>;
  human?: string;
  pathfinding?: Pathfinding;
  activity?: Activity;

  lastInput: number;

  position: Point;
  facing: Vector;
  speed: number;

  constructor(serialized: SerializedPlayer) {
    const { id, human, pathfinding, activity, lastInput, position, facing, speed } = serialized;
    this.id = parseGameId('players', id);
    this.human = human;
    this.pathfinding = pathfinding;
    this.activity = activity;
    this.lastInput = lastInput;
    this.position = position;
    this.facing = facing;
    this.speed = speed;
  }

  tick(game: Game, now: number) {
    if (this.human && this.lastInput < now - HUMAN_IDLE_TOO_LONG) {
      this.leave(game, now);
    }
  }

  tickPathfinding(game: Game, now: number) {
    // There's nothing to do if we're not moving.
    const { pathfinding, position } = this;
    if (!pathfinding) {
      return;
    }

    // Stop pathfinding if we've reached our destination.
    if (pathfinding.state.kind === 'moving' && pointsEqual(pathfinding.destination, position)) {
      stopPlayer(this);
    }

    // Stop pathfinding if we've timed out.
    if (pathfinding.started + PATHFINDING_TIMEOUT < now) {
      console.warn(`Timing out pathfinding for ${this.id}`);
      stopPlayer(this);
    }

    // Transition from "waiting" to "needsPath" if we're past the deadline.
    if (pathfinding.state.kind === 'waiting' && pathfinding.state.until < now) {
      pathfinding.state = { kind: 'needsPath' };
    }

    // Perform pathfinding if needed.
    if (pathfinding.state.kind === 'needsPath' && game.numPathfinds < MAX_PATHFINDS_PER_STEP) {
      game.numPathfinds++;
      if (game.numPathfinds === MAX_PATHFINDS_PER_STEP) {
        console.warn(`Reached max pathfinds for this step`);
      }
      const route = findRoute(game, now, this, pathfinding.destination);
      if (route === null) {
        console.log(`Failed to route to ${JSON.stringify(pathfinding.destination)}`);
        stopPlayer(this);
      } else {
        if (route.newDestination) {
          console.warn(
            `Updating destination from ${JSON.stringify(
              pathfinding.destination,
            )} to ${JSON.stringify(route.newDestination)}`,
          );
          pathfinding.destination = route.newDestination;
        }
        pathfinding.state = { kind: 'moving', path: route.path };
      }
    }
  }

  tickPosition(game: Game, now: number) {
    // There's nothing to do if we're not moving.
    if (!this.pathfinding || this.pathfinding.state.kind !== 'moving') {
      this.speed = 0;
      return;
    }

    // Compute a candidate new position and check if it collides
    // with anything.
    const candidate = pathPosition(this.pathfinding.state.path as any, now);
    if (!candidate) {
      console.warn(`Path out of range of ${now} for ${this.id}`);
      return;
    }
    const { position, facing, velocity } = candidate;
    const collisionReason = blocked(game, now, position, this.id);
    if (collisionReason !== null) {
      const backoff = Math.random() * PATHFINDING_BACKOFF;
      console.warn(`Stopping path for ${this.id}, waiting for ${backoff}ms: ${collisionReason}`);
      this.pathfinding.state = {
        kind: 'waiting',
        until: now + backoff,
      };
      // Set speed to 0 when stopped due to collision
      this.speed = 0;
      return;
    }
    // Update the player's location and facing direction.
    // Ensure facing is never a zero vector
    this.position = position;
    // Only update facing if the new facing vector is not (0,0)
    if (facing.dx !== 0 || facing.dy !== 0) {
        this.facing = facing;
    } 
    // If the new facing is (0,0), keep the old one - prevents facing reset at path end
    this.speed = velocity;
  }

  static join(
    game: Game,
    now: number,
    name: string,
    character: string,
    description: string,
    tokenIdentifier?: string,
  ) {
    if (tokenIdentifier) {
      let numHumans = 0;
      for (const player of game.world.players.values()) {
        if (player.human) {
          numHumans++;
        }
        if (player.human === tokenIdentifier) {
          throw new Error(`You are already in this game!`);
        }
      }
      if (numHumans >= MAX_HUMAN_PLAYERS) {
        throw new Error(`Only ${MAX_HUMAN_PLAYERS} human players allowed at once.`);
      }
    }

    // Improved initial position finding for better distribution
    let position: Point | undefined;
    const maxAttempts = 20;
    const margin = 5; // Larger margin from edges
    const centerMarginRatio = 0.3; // Avoid the central 30% of the map

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random coordinates further from the center and edges
      const candidate = {
        x: margin + Math.floor(Math.random() * (game.worldMap.width - 2 * margin)),
        y: margin + Math.floor(Math.random() * (game.worldMap.height - 2 * margin)),
      };

      // Check if the position is blocked
      if (blocked(game, now, candidate)) {
        continue;
      }
      
      // Check if the position is too close to the center
      const isCenter = 
        candidate.x > game.worldMap.width * centerMarginRatio &&
        candidate.x < game.worldMap.width * (1 - centerMarginRatio) &&
        candidate.y > game.worldMap.height * centerMarginRatio &&
        candidate.y < game.worldMap.height * (1 - centerMarginRatio);

      if (isCenter) {
          // 70% chance to reroll if it's in the center to encourage edge spawning
          if (Math.random() < 0.7) continue;
      }
      
      // Check if too close to another player
      let tooClose = false;
      for (const otherPlayer of game.world.players.values()) {
        if (distance(candidate, otherPlayer.position) < 3) { // Minimum distance of 3 tiles
          tooClose = true;
          break;
        }
      }
      if (tooClose) {
        continue;
      }

      // Found a suitable position
      position = candidate;
      break;
    }

    if (!position) {
      // Fallback: place randomly even if potentially blocked or central, but not on top of another player
      console.warn("Could not find ideal dispersed starting position, using fallback.");
       for (let attempt = 0; attempt < 10; attempt++) {
          const fallbackCandidate = {
            x: Math.floor(Math.random() * game.worldMap.width),
            y: Math.floor(Math.random() * game.worldMap.height),
          };
          let tooCloseFallback = false;
          for (const otherPlayer of game.world.players.values()) {
              if (distance(fallbackCandidate, otherPlayer.position) < 1) { // Allow closer fallback
                  tooCloseFallback = true;
                  break;
              }
          }
          if (!tooCloseFallback) {
              position = fallbackCandidate;
              break;
          }
       }
       if(!position) { // Ultimate fallback: place anywhere
            position = { x: Math.floor(Math.random() * game.worldMap.width), y: Math.floor(Math.random() * game.worldMap.height)};
       }
    }
    
    if (!characters.find((c) => c.name === character)) {
      throw new Error(`Invalid character: ${character}`);
    }
    const playerId = game.allocId('players');
    game.world.players.set(
      playerId,
      new Player({
        id: playerId,
        human: tokenIdentifier,
        lastInput: now,
        position,
        facing: { dx: 1, dy: 0 },
        speed: 0,
      }),
    );
    game.playerDescriptions.set(
      playerId,
      new PlayerDescription({
        playerId,
        character,
        description,
        name,
      }),
    );
    game.descriptionsModified = true;
    return playerId;
  }

  leave(game: Game, now: number) {
    // Stop our conversation if we're leaving the game.
    const conversation = [...game.world.conversations.values()].find((c) =>
      c.participants.has(this.id),
    );
    if (conversation) {
      conversation.stop(game, now);
    }
    game.world.players.delete(this.id);
  }

  serialize(): SerializedPlayer {
    const { id, human, pathfinding, activity, lastInput, position, facing, speed } = this;
    return {
      id,
      human,
      pathfinding,
      activity,
      lastInput,
      position,
      facing,
      speed,
    };
  }
}

export const playerInputs = {
  join: inputHandler({
    args: {
      name: v.string(),
      character: v.string(),
      description: v.string(),
      tokenIdentifier: v.optional(v.string()),
    },
    handler: (game, now, args) => {
      Player.join(game, now, args.name, args.character, args.description, args.tokenIdentifier);
      return null;
    },
  }),
  leave: inputHandler({
    args: { playerId },
    handler: (game, now, args) => {
      const playerId = parseGameId('players', args.playerId);
      const player = game.world.players.get(playerId);
      if (!player) {
        throw new Error(`Invalid player ID ${playerId}`);
      }
      player.leave(game, now);
      return null;
    },
  }),
  moveTo: inputHandler({
    args: {
      playerId,
      destination: v.union(point, v.null()),
    },
    handler: (game, now, args) => {
      const playerId = parseGameId('players', args.playerId);
      const player = game.world.players.get(playerId);
      if (!player) {
        throw new Error(`Invalid player ID ${playerId}`);
      }
      if (args.destination) {
        movePlayer(game, now, player, args.destination);
      } else {
        stopPlayer(player);
      }
      return null;
    },
  }),
};
