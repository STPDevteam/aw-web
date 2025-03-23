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
        onComplete();  
      }
    }
  
    update();
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

  ): boolean {
    const checkPoints = 20; 
  
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

 
function checkForObstacleAndChangeDirection(sprite: PIXI.Sprite | PIXI.AnimatedSprite, agentFacing: { dx: number; dy: number }, startPos: { x: number; y: number }) {
  const tileDim = 32; 
  const distanceThreshold = 3 * tileDim; 

  
  if (agentFacing.dx !== 0) {
    const direction = agentFacing.dx > 0 ? 1 : -1; 
    const checkX = sprite.x + direction * distanceThreshold; 

    if (isPositionObstacle(checkX, sprite.y, tileDim)) { 

      const directions = [
        { dx: 0, dy: 1 },   
        { dx: 0, dy: -1 }  
      ];
      const randomDir = directions[Math.floor(Math.random() * directions.length)];
      agentFacing.dx = randomDir.dx;
      agentFacing.dy = randomDir.dy;


      if (sprite instanceof PIXI.AnimatedSprite) {
        updateSpriteFacing(sprite as ExtendedAnimatedSprite, agentFacing);
      }

     
      sprite.x = startPos.x;
      sprite.y = startPos.y;
    }
  } else if (agentFacing.dy !== 0) { 
    const direction = agentFacing.dy > 0 ? 1 : -1; 
    const checkY = sprite.y + direction * distanceThreshold;

    if (isPositionObstacle(sprite.x, checkY, tileDim)) {  
  
      const directions = [
        { dx: 1, dy: 0 },   
        { dx: -1, dy: 0 }   
      ];
      const randomDir = directions[Math.floor(Math.random() * directions.length)];
      agentFacing.dx = randomDir.dx;
      agentFacing.dy = randomDir.dy;

     
      if (sprite instanceof PIXI.AnimatedSprite) {
        updateSpriteFacing(sprite as ExtendedAnimatedSprite, agentFacing);
      }

    
      sprite.x = startPos.x;
      sprite.y = startPos.y;
    }
  }
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

  checkForObstacleAndChangeDirection(sprite, agentFacing, startPos);

  let { dx, dy } = agentFacing;  

  let distanceTiles: number = 0;
  let distance: number = 0;
  let endPos: { x: number; y: number } = { x: startPos.x, y: startPos.y };
  let valid = false;

  const maxAttempts = 3;
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
     
    );

    let noAgentCollisions = true;

    valid = withinBounds && noObstacles && noAgentCollisions;
    attempts++;
  }

  if (!valid) {
    // console.log("Unable to find valid path or blocked by obstacle, changing direction");

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

            // const emojiChar = '🚀'
            const emojiChar = agentsData[idx].emoji
            const emojiText = new PIXI.Text(emojiChar, {
              fontSize: 24,
              fill: "yellow",
              align: "center",
            });
            emojiText.anchor.set(0.5, 0.5);
            emojiText.scale.set(1.2, 1.2);
            emojiText.x = 12;
            emojiText.y = -42; 

            sprite.addChild(emojiText);

           
            sprite.interactive = true;
            sprite.cursor = "pointer";
           
            sprite.on('pointerdown', () => {              
              localStorage.setItem('agentId', agentsData[idx].id)
            });


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
