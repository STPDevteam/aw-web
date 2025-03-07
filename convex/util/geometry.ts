import { Path, PathComponent, Point, Vector, packPathComponent, queryPath } from './types';

export function distance(p0: Point, p1: Point): number {
  const dx = p0.x - p1.x;
  const dy = p0.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pointsEqual(p0: Point, p1: Point): boolean {
  return p0.x == p1.x && p0.y == p1.y;
}

export function manhattanDistance(p0: Point, p1: Point) {
  return Math.abs(p0.x - p1.x) + Math.abs(p0.y - p1.y);
}

export function pathOverlaps(path: Path, time: number): boolean {
  if (path.length < 2) {
    throw new Error(`Invalid path: ${JSON.stringify(path)}`);
  }
  const start = queryPath(path, 0);
  const end = queryPath(path, path.length - 1);
  return start.t <= time && time <= end.t;
}

export function pathPosition(
  path: Path,
  time: number,
): { position: Point; facing: Vector; velocity: number } {
  if (!path || !Array.isArray(path) || path.length < 2) {
    console.error(`Invalid path format: ${JSON.stringify(path)}`);
    return { 
      position: { x: 0, y: 0 }, 
      facing: { dx: 0, dy: 0 },
      velocity: 0 
    };
  }
  
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if (!Array.isArray(segment) || segment.length !== 5 || 
        typeof segment[0] !== 'number' || typeof segment[1] !== 'number' || 
        typeof segment[2] !== 'number' || typeof segment[3] !== 'number' || 
        typeof segment[4] !== 'number') {
      console.error(`Invalid path segment at index ${i}: ${JSON.stringify(segment)}`);
      return { 
        position: { x: 0, y: 0 }, 
        facing: { dx: 0, dy: 0 },
        velocity: 0 
      };
    }
  }
  
  try {
    const first = queryPath(path, 0);
    if (time < first.t) {
      return { position: first.position, facing: first.facing, velocity: 0 };
    }
    const last = queryPath(path, path.length - 1);
    if (last.t < time) {
      return { position: last.position, facing: last.facing, velocity: 0 };
    }
    for (let i = 0; i < path.length - 1; i++) {
      const segmentStart = queryPath(path, i);
      const segmentEnd = queryPath(path, i + 1);
      
      if (segmentEnd.t - segmentStart.t <= 0) {
        continue;
      }
      
      if (segmentStart.t <= time && time <= segmentEnd.t) {
        const interp = (time - segmentStart.t) / (segmentEnd.t - segmentStart.t);
        return {
          position: {
            x: segmentStart.position.x + interp * (segmentEnd.position.x - segmentStart.position.x),
            y: segmentStart.position.y + interp * (segmentEnd.position.y - segmentStart.position.y),
          },
          facing: segmentStart.facing,
          velocity:
            distance(segmentStart.position, segmentEnd.position) / (segmentEnd.t - segmentStart.t),
        };
      }
    }
  } catch (e) {
    console.error(`Error in pathPosition: ${e}`);
    return { 
      position: { x: 0, y: 0 }, 
      facing: { dx: 0, dy: 0 },
      velocity: 0 
    };
  }
  
  console.warn(`Could not find path segment for time ${time}`);
  return { 
    position: { x: 0, y: 0 }, 
    facing: { dx: 0, dy: 0 },
    velocity: 0 
  };
}

export const EPSILON = 0.0001;

export function vector(p0: Point, p1: Point): Vector {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  return { dx, dy };
}

export function vectorLength(vector: Vector): number {
  return Math.sqrt(vector.dx * vector.dx + vector.dy * vector.dy);
}

export function normalize(vector: Vector): Vector | null {
  const len = vectorLength(vector);
  if (len < EPSILON) {
    return null;
  }
  const { dx, dy } = vector;
  return {
    dx: dx / len,
    dy: dy / len,
  };
}

export function orientationDegrees(vector: Vector): number {
  if (Math.sqrt(vector.dx * vector.dx + vector.dy * vector.dy) < EPSILON) {
    throw new Error(`Can't compute the orientation of too small vector ${JSON.stringify(vector)}`);
  }
  const twoPi = 2 * Math.PI;
  const radians = (Math.atan2(vector.dy, vector.dx) + twoPi) % twoPi;
  return (radians / twoPi) * 360;
}

export function compressPath(densePath: PathComponent[]): Path {
  if (!densePath || !Array.isArray(densePath) || densePath.length === 0) {
    console.error('Invalid densePath provided to compressPath:', densePath);
    return [[0, 0, 0, 0, 0], [1, 1, 0, 0, 1]];
  }
  
  for (let i = 0; i < densePath.length; i++) {
    const component = densePath[i];
    if (!component || typeof component.position?.x !== 'number' || 
        typeof component.position?.y !== 'number' || 
        typeof component.facing?.dx !== 'number' || 
        typeof component.facing?.dy !== 'number' || 
        typeof component.t !== 'number' ||
        isNaN(component.position?.x) || 
        isNaN(component.position?.y) ||
        isNaN(component.facing?.dx) || 
        isNaN(component.facing?.dy) || 
        isNaN(component.t)) {
      console.error(`Invalid path component at index ${i}:`, component);
      return [[0, 0, 0, 0, 0], [1, 1, 0, 0, 1]];
    }
  }
  
  try {
    if (densePath.length <= 2) {
      return densePath.map(packPathComponent);
    }
    
    const out = [packPathComponent(densePath[0])];
    let last = densePath[0];
    let candidate;
    
    for (const point of densePath.slice(1)) {
      if (!candidate) {
        candidate = point;
        continue;
      }
      
      try {
        const { position, facing } = pathPosition(
          [packPathComponent(last), packPathComponent(point)],
          candidate.t,
        );
        
        const positionCloseEnough = distance(position, candidate.position) < EPSILON;
        const facingDifference = {
          dx: facing.dx - candidate.facing.dx,
          dy: facing.dy - candidate.facing.dy,
        };
        const facingCloseEnough = vectorLength(facingDifference) < EPSILON;

        if (positionCloseEnough && facingCloseEnough) {
          candidate = point;
          continue;
        }
      } catch (e) {
        console.error('Error during path interpolation:', e);
      }

      out.push(packPathComponent(candidate));
      last = candidate;
      candidate = point;
    }
    
    if (candidate) {
      out.push(packPathComponent(candidate));
    }
    
    if (out.length < 2) {
      console.warn('Path too short after compression, adding endpoint');
      const lastPoint = out[0];
      out.push([lastPoint[0] + 1, lastPoint[1] + 1, lastPoint[2], lastPoint[3], lastPoint[4] + 1000]);
    }
    
    return out;
  } catch (e) {
    console.error('Error in compressPath:', e);
    return [[0, 0, 0, 0, 0], [1, 1, 0, 0, 1]];
  }
}
