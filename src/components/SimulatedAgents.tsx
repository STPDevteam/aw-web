import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { createSimulatedAgentSprite, SimulatedAgent } from './createSimulatedAgentSprite';
import { mockAgents } from '../../data/characters';
import * as map from '../../data/gentle';


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
    let distanceTiles: number, distance: number, endPos: { x: number; y: number }, targetTileX: number, targetTileY: number;
    do {
      distanceTiles = Math.random() * (maxDistanceTiles - minDistanceTiles) + minDistanceTiles;
      distance = distanceTiles * tileDim;
      endPos = {
        x: startPos.x + (dx !== 0 ? Math.sign(dx) * distance : 0),
        y: startPos.y + (dy !== 0 ? Math.sign(dy) * distance : 0),
      };
      targetTileX = endPos.x / tileDim;
      targetTileY = endPos.y / tileDim;
      attempts++;
    } while (isTileBlocked(targetTileX, targetTileY, objmap) && attempts < maxAttempts);
  

    if (isTileBlocked(targetTileX, targetTileY, objmap)) {
      setTimeout(() => {
        animateAgent(sprite, container, speed, minDistanceTiles, maxDistanceTiles, agentFacing, allSprites, tileDim, objmap);
      }, 100);
      return;
    }
  
 
    const duration = (distance / speed) * 1000;
    animateMovement(sprite, startPos, endPos, duration, () => {
      animateAgent(sprite, container, speed, minDistanceTiles, maxDistanceTiles, agentFacing, allSprites, tileDim, objmap);
    });
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
