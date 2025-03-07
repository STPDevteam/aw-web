import { Infer, ObjectType, v } from 'convex/values';
import { Point, Vector, path, point, vector, Path } from '../util/types';
import { GameId, allocGameId, parseGameId, playerId } from './ids';
import {
  PATHFINDING_TIMEOUT,
  PATHFINDING_BACKOFF,
  HUMAN_IDLE_TOO_LONG,
  MAX_HUMAN_PLAYERS,
  MAX_PATHFINDS_PER_STEP,
} from '../constants';
import { pointsEqual, pathPosition } from '../util/geometry';
import { Game } from './game';
import { stopPlayer, findRoute, blocked, movePlayer } from './movement';
import { inputHandler } from './inputHandler';
import { characters, movementSpeed } from '../../data/characters';
import { PlayerDescription } from './playerDescription';
import { ACTIVITY_COOLDOWN } from '../constants';

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

    // 增加寻路超时时间，减少因超时而停止的机会
    // Stop pathfinding if we've timed out.
    if (pathfinding.started + PATHFINDING_TIMEOUT * 2 < now) {
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
      
      // 尝试寻路
      const route = findRoute(game, now, this, pathfinding.destination);
      
      if (route === null) {
        // 如果寻路失败，不要立即放弃，而是使用直线路径
        console.log(`Failed to route to ${JSON.stringify(pathfinding.destination)}, using direct path`);
        
        // 创建一个简单的直线路径
        const startTime = now;
        const distance = Math.sqrt(
          Math.pow(this.position.x - pathfinding.destination.x, 2) + 
          Math.pow(this.position.y - pathfinding.destination.y, 2)
        );
        const endTime = startTime + (distance / movementSpeed) * 1000;
        
        // 计算朝向
        const dx = pathfinding.destination.x - this.position.x;
        const dy = pathfinding.destination.y - this.position.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const normalizedDx = length > 0 ? dx / length : 0;
        const normalizedDy = length > 0 ? dy / length : 0;
        
        const directPath: Path = [
          [this.position.x, this.position.y, normalizedDx, normalizedDy, startTime],
          [pathfinding.destination.x, pathfinding.destination.y, normalizedDx, normalizedDy, endTime]
        ];
        
        pathfinding.state = { kind: 'moving', path: directPath };
      } else {
        // 寻路成功
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

    // 增加对路径的有效性检查
    if (!this.pathfinding.state.path || !Array.isArray(this.pathfinding.state.path) || this.pathfinding.state.path.length < 2) {
      console.warn(`Invalid path for player ${this.id}, stopping pathfinding`);
      stopPlayer(this);
      return;
    }

    try {
      // Compute a candidate new position and check if it collides
      // with anything.
      const candidate = pathPosition(this.pathfinding.state.path as Path, now);
      
      // 检查candidate是否有效
      if (!candidate || 
          typeof candidate.position?.x !== 'number' || 
          typeof candidate.position?.y !== 'number' ||
          isNaN(candidate.position?.x) || 
          isNaN(candidate.position?.y)) {
        console.warn(`Invalid position calculated for ${this.id}, stopping pathfinding`);
        stopPlayer(this);
        return;
      }

      const { position, facing, velocity } = candidate;
      
      // 检查位置是否在地图范围内
      if (position.x < 0 || position.y < 0 || 
          position.x >= game.worldMap.width || 
          position.y >= game.worldMap.height) {
        console.warn(`Position out of bounds for ${this.id}, stopping pathfinding`);
        stopPlayer(this);
        return;
      }
      
      // 不再考虑碰撞，直接更新位置
      // const collisionReason = blocked(game, now, position, this.id);
      // if (collisionReason !== null) {
      //   const backoff = Math.random() * PATHFINDING_BACKOFF;
      //   console.warn(`Stopping path for ${this.id}, waiting for ${backoff}ms: ${collisionReason}`);
      //   this.pathfinding.state = {
      //     kind: 'waiting',
      //     until: now + backoff,
      //   };
      //   this.speed = 0;
      //   return;
      // }
      
      // 更新位置
      this.position = position;
      this.facing = facing;
      this.speed = velocity;

      // 检查是否到达目的地
      if (pointsEqual(this.position, this.pathfinding.destination)) {
        stopPlayer(this);
      }
    } catch (e) {
      // 捕获任何可能发生的错误，确保不会导致游戏崩溃
      console.error(`Error in tickPosition for player ${this.id}: ${e}`);
      stopPlayer(this);
    }
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
    let position;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = {
        x: Math.floor(Math.random() * game.worldMap.width),
        y: Math.floor(Math.random() * game.worldMap.height),
      };
      if (blocked(game, now, candidate)) {
        continue;
      }
      position = candidate;
      break;
    }
    if (!position) {
      throw new Error(`Failed to find a free position!`);
    }
    const facingOptions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    const facing = facingOptions[Math.floor(Math.random() * facingOptions.length)];
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
        facing,
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
