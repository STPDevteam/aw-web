import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { createSimulatedAgentSprite, SimulatedAgent, ExtendedAnimatedSprite} from './createSimulatedAgentSprite';
import { mockAgents } from '../../data/characters';
import * as map from '../../data/gentle';
import { orientationDegrees } from '../../convex/util/geometry';

type SimulatedAgentsProps = {
  container: PIXI.Container; 
  tileDim: number;
  mapWidth: number
};

const SimulatedAgents: React.FC<SimulatedAgentsProps> = React.memo(({ container, tileDim, mapWidth }) => {
  const simulatedContainerRef = useRef<PIXI.Container | null>(null);


  function isTileObstacle(tileX: number, tileY: number, objmap: number[][][], bgtiles: number[][][]): boolean {
    const isOutOfBounds = tileX < 0 || tileY < 0 || 
                           tileX >= objmap[0].length || 
                           tileY >= (objmap[0][0]?.length || 0);
    if (isOutOfBounds) return true;  
  
    const blockedInObj = objmap.some(layer => {
      return layer[tileX] && layer[tileX][tileY] !== -1;
    });
  
    const blockedInBg = false;  
  
    return blockedInObj || blockedInBg;
  }
  
  
  
  

  function willAgentsCollide(
    sprite1: PIXI.Sprite | PIXI.AnimatedSprite,
    sprite1StartPos: { x: number; y: number },
    sprite1EndPos: { x: number; y: number },
    sprite2: PIXI.Sprite | PIXI.AnimatedSprite,
    sprite2StartPos: { x: number; y: number },
    sprite2EndPos: { x: number; y: number },
    collisionDistance: number
  ): boolean {
    const checkPoints = 4; 
    
    for (let i = 1; i <= checkPoints; i++) {
      const ratio = i / checkPoints;
      const sprite1CheckX = sprite1StartPos.x + (sprite1EndPos.x - sprite1StartPos.x) * ratio;
      const sprite1CheckY = sprite1StartPos.y + (sprite1EndPos.y - sprite1StartPos.y) * ratio;
      
      const sprite2CheckX = sprite2StartPos.x + (sprite2EndPos.x - sprite2StartPos.x) * ratio;
      const sprite2CheckY = sprite2StartPos.y + (sprite2EndPos.y - sprite2StartPos.y) * ratio;
      
      const distance = Math.sqrt(
        Math.pow(sprite1CheckX - sprite2CheckX, 2) + 
        Math.pow(sprite1CheckY - sprite2CheckY, 2)
      );
      
      if (distance < collisionDistance) {
        return true; 
      }
    }
    
    return false; 
  }
  
  

  
 
  
    

function animateMovement(
  sprite: PIXI.Sprite | PIXI.AnimatedSprite,
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
  duration: number,
  onComplete: () => void
) {
  const startTime = Date.now();
  function update() {
    const now = Date.now();
    const progress = Math.min((now - startTime) / duration, 1);
    

    const newX = startPos.x + (endPos.x - startPos.x) * progress;
    const newY = startPos.y + (endPos.y - startPos.y) * progress;
    

    const containerWidth = sprite.parent?.width || 1000; 
    const containerHeight = sprite.parent?.height || 1000; 
    

    sprite.x = Math.max(0, Math.min(newX, containerWidth));
    sprite.y = Math.max(0, Math.min(newY, containerHeight));
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
  
      if (sprite.x < 0 || sprite.x > containerWidth || 
          sprite.y < 0 || sprite.y > containerHeight) {
        console.warn("The sprite moves out of view, reset position");
        sprite.x = Math.max(0, Math.min(endPos.x, containerWidth));
        sprite.y = Math.max(0, Math.min(endPos.y, containerHeight));
      }
      onComplete();
    }
  }
  update();
}
    


  function isPositionObstacle(x: number, y: number, tileDim: number): boolean {
    const tileX = Math.floor(x / tileDim);
    const tileY = Math.floor(y / tileDim);
    const isOutOfBounds = tileX < 0 || tileY < 0 || 
                          tileX >= map.objmap[0].length || 
                          tileY >= (map.objmap[0][0]?.length || 0);
    if (isOutOfBounds) return true;
    const blockedInObj = map.objmap.some(layer => {
      return layer[tileX] && layer[tileX][tileY] !== -1;
    });
    return blockedInObj;
  }

  function isPositionNearObstacle(x: number, y: number, tileDim: number): boolean {
    const tileX = Math.floor(x / tileDim);
    const tileY = Math.floor(y / tileDim);
    
    const isOutOfBounds = tileX < 0 || tileY < 0 || 
                          tileX >= map.objmap[0].length || 
                          tileY >= (map.objmap[0][0]?.length || 0);
    if (isOutOfBounds) return true;
  
    const blockedInObj = map.objmap.some(layer => {
      return layer[tileX] && layer[tileX][tileY] !== -1;
    });
  
    return blockedInObj;
  }
  
  function willCollideWithObstacle(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    tileDim: number,
    objmap: number[][][],
    bgtiles: number[][][]
  ): boolean {
    const checkPoints = 3; 
  
    for (let i = 1; i <= checkPoints; i++) {
      const ratio = i / (checkPoints + 1);
      const checkX = startX + (endX - startX) * ratio;
      const checkY = startY + (endY - startY) * ratio;
  
      if (isPositionNearObstacle(checkX, checkY, tileDim)) {
        return true; 
      }
    }
  
    return false;
  }
  


function animateAgent(
  sprite: PIXI.Sprite | PIXI.AnimatedSprite,
  container: PIXI.Container,
  speed: number,            
  minDistanceTiles: number,   
  maxDistanceTiles: number,   
  agentFacing: { dx: number; dy: number },
  allSprites: Array<PIXI.Sprite | PIXI.AnimatedSprite>, 
  tileDim: number,
  objmap: number[][][],
  bgtiles: number[][][],
  mapWidth: number
) {
  const startPos = { x: sprite.x, y: sprite.y };
  let { dx, dy } = agentFacing;  

  let distanceTiles: number = 0;
  let distance: number = 0;
  let endPos: { x: number; y: number } = { x: startPos.x, y: startPos.y };
  let valid = false;

  const maxAttempts = 8;
  let attempts = 0;

  while (attempts < maxAttempts && !valid) {
    distanceTiles = minDistanceTiles + (maxDistanceTiles - minDistanceTiles) * Math.random();
    distance = distanceTiles * tileDim;

    endPos = {
      x: startPos.x + (dx !== 0 ? Math.sign(dx) * distance : 0),
      y: startPos.y + (dy !== 0 ? Math.sign(dy) * distance : 0),
    };

    const withinBounds = endPos.x >= 0 && endPos.x <= container.width && endPos.y >= 0 && endPos.y <= container.height;
    const noObstacles = !willCollideWithObstacle(
      startPos.x,
      startPos.y,
      endPos.x,
      endPos.y,
      tileDim,
      objmap,
      bgtiles
    );

    let noAgentCollisions = true;
    if (withinBounds && noObstacles) {
      for (const otherSprite of allSprites) {
        if (otherSprite !== sprite && (otherSprite as any).isMoving) {
          const otherStartPos = { x: otherSprite.x, y: otherSprite.y };
          const otherEndPos = (otherSprite as any).targetPos || otherStartPos;

          if (willAgentsCollide(
            sprite, startPos, endPos,
            otherSprite, otherStartPos, otherEndPos,
            tileDim 
          )) {
            noAgentCollisions = false;
            break;
          }
        }
      }
    }

    valid = withinBounds && noObstacles && noAgentCollisions;
    attempts++;
  }

  if (!valid) {
    console.log("Unable to find valid path or blocked by obstacle, changing direction");

    const randomDir = Math.floor(Math.random() * 4);
    const newFacing = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ][randomDir];

    agentFacing.dx = newFacing.dx;
    agentFacing.dy = newFacing.dy;

    if (sprite instanceof PIXI.AnimatedSprite) {
      updateSpriteFacing(sprite as ExtendedAnimatedSprite, newFacing);
    }

    setTimeout(() => {
      sprite.x = startPos.x;
      sprite.y = startPos.y;

      animateAgent(
        sprite,
        container,
        speed,
        minDistanceTiles,
        maxDistanceTiles,
        agentFacing,
        allSprites,
        tileDim,
        objmap,
        bgtiles,
        mapWidth
      );
    }, 500);
    return;
  }

  (sprite as any).targetPos = endPos;
  (sprite as any).isMoving = true;

  const duration = (distance / speed) * 1000;
  animateMovement(sprite, startPos, endPos, duration, () => {
    (sprite as any).isMoving = false;
    animateAgent(
      sprite,
      container,
      speed,
      minDistanceTiles,
      maxDistanceTiles,
      agentFacing,
      allSprites,
      tileDim,
      objmap,
      bgtiles,
      mapWidth
    );
  });
}

  


  function updateSpriteFacing(sprite: ExtendedAnimatedSprite, facing: { dx: number; dy: number }) {
    const orientation = orientationDegrees(facing); 
    const roundedOrientation = Math.floor(orientation / 90);
    const directions = ['right', 'down', 'left', 'up'];
    const newDir = directions[roundedOrientation];
    if (sprite._sheet && sprite._sheet.animations && sprite._sheet.animations[newDir]) {
      sprite.textures = sprite._sheet.animations[newDir];
      sprite.play();
    }
  }

  useEffect(() => {
    if (!container) return;
    if (!simulatedContainerRef.current) {
      const simulatedContainer = new PIXI.Container();
      simulatedContainer.name = "simulatedAgentsContainer";
      simulatedContainerRef.current = simulatedContainer;
      const agentsData: SimulatedAgent[] = mockAgents();

      Promise.all(agentsData.map((agent) => createSimulatedAgentSprite(agent, tileDim)))
        .then((sprites) => {
          const allSprites = sprites;
          sprites.forEach((sprite, idx) => {
            simulatedContainer.addChild(sprite);
            animateAgent(
              sprite,
              simulatedContainer,
              tileDim, 
              0,  
              container.height / tileDim,
              agentsData[idx].facing,
              allSprites,
              tileDim,
              map.objmap,
              map.bgtiles,
              mapWidth
            );
          });
        })
        .catch((error) => {
          console.error("Error creating simulated agent sprites:", error);
        });
      container.addChild(simulatedContainer);
    }
    return () => {
      if (simulatedContainerRef.current) {
        container.removeChild(simulatedContainerRef.current);
        simulatedContainerRef.current.destroy({ children: true });
        simulatedContainerRef.current = null;
      }
    };
  }, [container, tileDim, mapWidth]);


  return null;
});

export default SimulatedAgents;
