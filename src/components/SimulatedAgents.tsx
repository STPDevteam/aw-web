
import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { createSimulatedAgentSprite, SimulatedAgent } from './createSimulatedAgentSprite';
import { mockAgents } from '../../data/characters'; 


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
  

  function animateAgent(
    sprite: PIXI.Sprite | PIXI.AnimatedSprite,
    container: PIXI.Container,
    speed: number,
    minDistance: number,
    maxDistance: number,
    agentFacing: { dx: number; dy: number }
  ) {
    const startPos = { x: sprite.x, y: sprite.y };
    const angle = Math.atan2(agentFacing.dy, agentFacing.dx);
    const distance = Math.random() * (maxDistance - minDistance) + minDistance;
    const endPos = {
      x: startPos.x + Math.cos(angle) * distance,
      y: startPos.y + Math.sin(angle) * distance,
    };
    const duration = (distance / speed) * 1000;
    animateMovement(sprite, startPos, endPos, duration, () => {
      animateAgent(sprite, container, speed, minDistance, maxDistance, agentFacing);
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
          sprites.forEach((sprite, idx) => {
            simulatedContainer.addChild(sprite);
            animateAgent(
              sprite,
              simulatedContainer,
              tileDim, 
              0,  
              container.height, 
              agentsData[idx].facing 
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
