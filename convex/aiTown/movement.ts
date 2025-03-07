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
  try {
    // 首先检查目标点是否在地图边界内
    if (destination.x < 0 || destination.y < 0 || 
        destination.x >= game.worldMap.width || 
        destination.y >= game.worldMap.height) {
      console.warn(`Destination out of bounds: ${JSON.stringify(destination)}`);
      return null;
    }
    
    // 简化寻路：只使用直线路径连接当前位置和目标位置
    const startTime = now;
    const straightLineDistance = Math.sqrt(
      Math.pow(player.position.x - destination.x, 2) + 
      Math.pow(player.position.y - destination.y, 2)
    );
    
    // 计算到达时间 (时间 = 距离 / 速度)
    const endTime = startTime + (straightLineDistance / movementSpeed) * 1000;
    
    // 计算朝向
    const dx = destination.x - player.position.x;
    const dy = destination.y - player.position.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const normalizedDx = length > 0 ? dx / length : 0;
    const normalizedDy = length > 0 ? dy / length : 0;
    
    // 创建直线路径
    const directPath: PathComponent[] = [
      {
        position: { x: player.position.x, y: player.position.y },
        facing: { dx: normalizedDx, dy: normalizedDy },
        t: startTime
      },
      {
        position: { x: destination.x, y: destination.y },
        facing: { dx: normalizedDx, dy: normalizedDy },
        t: endTime
      }
    ];
    
    // 如果距离很远，添加一些中间点，使移动更加平滑
    if (straightLineDistance > 4) {
      const numIntermediatePoints = Math.min(Math.floor(straightLineDistance / 2), 5);
      const updatedPath: PathComponent[] = [directPath[0]];
      
      for (let i = 1; i <= numIntermediatePoints; i++) {
        const ratio = i / (numIntermediatePoints + 1);
        const intermediateX = player.position.x + dx * ratio;
        const intermediateY = player.position.y + dy * ratio;
        const intermediateTime = startTime + (endTime - startTime) * ratio;
        
        updatedPath.push({
          position: { x: intermediateX, y: intermediateY },
          facing: { dx: normalizedDx, dy: normalizedDy },
          t: intermediateTime
        });
      }
      
      updatedPath.push(directPath[1]);
      return { path: compressPath(updatedPath), newDestination: null };
    }
    
    return { path: compressPath(directPath), newDestination: null };
  } catch (e) {
    console.error(`Error in findRoute: ${e}`);
    return null;
  }
}

export function blocked(game: Game, now: number, pos: Point, playerId?: GameId<'players'>) {
  // 完全禁用碰撞检测，总是返回null（表示没有障碍）
  // 只检查是否越界，其他都不检查
  if (pos.x < 0 || pos.y < 0 || pos.x >= game.worldMap.width || pos.y >= game.worldMap.height) {
    return 'out of bounds';
  }
  return null;
}

export function blockedWithPositions(position: Point, otherPositions: Point[], map: WorldMap) {
  // 完全禁用碰撞检测，只保留地图边界检查
  if (position.x < 0 || position.y < 0 || position.x >= map.width || position.y >= map.height) {
    return 'out of bounds';
  }
  // 不再检查物体层和其他玩家的碰撞
  return null;
}
