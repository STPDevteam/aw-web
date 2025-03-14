import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { createSimulatedAgentSprite, SimulatedAgent, ExtendedAnimatedSprite} from './createSimulatedAgentSprite';
import { mockAgents } from '../../data/characters';
import * as map from '../../data/gentle';
import { orientationDegrees } from '../../convex/util/geometry';

type SimulatedAgentsProps = {
  container: PIXI.Container; 
  tileDim: number;
};

const SimulatedAgents: React.FC<SimulatedAgentsProps> = React.memo(({ container, tileDim }) => {
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
      sprite.x = startPos.x + (endPos.x - startPos.x) * progress;
      sprite.y = startPos.y + (endPos.y - startPos.y) * progress;
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        onComplete();
      }
    }
    update();
  }

  function isTileBlocked(tileX: number, tileY: number, objmap: number[][][]): boolean {
    for (const layer of objmap) {
      if (layer[Math.floor(tileX)] && layer[Math.floor(tileX)][Math.floor(tileY)] !== -1) {
        return true;
      }
    }
    return false;
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

  
  function animateAgent(
    sprite: PIXI.Sprite | PIXI.AnimatedSprite,
    container: PIXI.Container,
    speed: number,            
    minDistanceTiles: number,   
    maxDistanceTiles: number,   
    agentFacing: { dx: number; dy: number },
    allSprites: Array<PIXI.Sprite | PIXI.AnimatedSprite>,
    tileDim: number,
    objmap: number[][][]
  ) {
    const startPos = { x: sprite.x, y: sprite.y };
  
    let { dx, dy } = agentFacing;
    if (dx !== 0 && dy !== 0) {
      if (Math.random() < 0.5) {
        dy = 0;
      } else {
        dx = 0;
      }
    }
  
  
    const maxAttempts = 10;
    let attempts = 0;
    let distanceTiles: number = 0;
    let distance: number = 0;
    let endPos: { x: number; y: number } = { x: startPos.x, y: startPos.y };
    let valid = false;
    while (attempts < maxAttempts) {
      distanceTiles = Math.random() * (maxDistanceTiles - minDistanceTiles) + minDistanceTiles;
      distance = distanceTiles * tileDim;
      endPos = {
        x: startPos.x + (dx !== 0 ? Math.sign(dx) * distance : 0),
        y: startPos.y + (dy !== 0 ? Math.sign(dy) * distance : 0),
      };
    
      if (endPos.x >= 0 && endPos.x <= container.width && endPos.y >= 0 && endPos.y <= container.height) {
        valid = true;
        break;
      }
      attempts++;
    }
  
    if (!valid) {
      const newFacing = getNewFacingForBoundary(sprite.x, sprite.y, container);
      dx = newFacing.dx;
      dy = newFacing.dy;
   
      if (sprite instanceof PIXI.AnimatedSprite) {
        updateSpriteFacing(sprite as ExtendedAnimatedSprite, newFacing);
      }
      distanceTiles = (minDistanceTiles + maxDistanceTiles) / 2;
      distance = distanceTiles * tileDim;
      endPos = {
        x: startPos.x + (dx !== 0 ? Math.sign(dx) * distance : 0),
        y: startPos.y + (dy !== 0 ? Math.sign(dy) * distance : 0),
      };
   
      endPos.x = Math.max(0, Math.min(endPos.x, container.width));
      endPos.y = Math.max(0, Math.min(endPos.y, container.height));
    }
  
   
    const targetTileX = endPos.x / tileDim;
    const targetTileY = endPos.y / tileDim;
    if (isTileBlocked(targetTileX, targetTileY, objmap)) {
  
      const newFacing = { dx: -dx, dy: -dy };
  
      if (sprite instanceof PIXI.AnimatedSprite) {
        updateSpriteFacing(sprite as ExtendedAnimatedSprite, newFacing);
      }
      setTimeout(() => {
        animateAgent(sprite, container, speed, minDistanceTiles, maxDistanceTiles, newFacing, allSprites, tileDim, objmap);
      }, 100);
      return;
    }
  

    const duration = (distance / speed) * 1000;
    animateMovement(sprite, startPos, endPos, duration, () => {
      animateAgent(sprite, container, speed, minDistanceTiles, maxDistanceTiles, { dx, dy }, allSprites, tileDim, objmap);
    });
  }

  

  function getNewFacingForBoundary(x: number, y: number, container: PIXI.Container): { dx: number; dy: number } {
    const directions: Array<{ dx: number; dy: number }> = [];
    if (x <= 0) directions.push({ dx: 1, dy: 0 });
    if (x >= container.width) directions.push({ dx: -1, dy: 0 });
    if (y <= 0) directions.push({ dx: 0, dy: 1 });
    if (y >= container.height) directions.push({ dx: 0, dy: -1 });
    return directions.length > 0 ? directions[Math.floor(Math.random() * directions.length)] : { dx: 1, dy: 0 };
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
              map.objmap 
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
  }, [container, tileDim]);
  

  

  return null;
});

export default SimulatedAgents;
