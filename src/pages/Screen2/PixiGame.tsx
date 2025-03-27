import * as PIXI from 'pixi.js';
import { useApp } from '@pixi/react';
import { Player, SelectElement } from '../../components/Player.tsx';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { PixiStaticMap } from '../../components/PixiStaticMap.tsx';
import PixiViewport from '../../components/PixiViewport.tsx';
import { Viewport } from 'pixi-viewport';
import { Id } from '../../../convex/_generated/dataModel';
import { useQuery, useMutation} from 'convex/react';
import { api } from '../../../convex/_generated/api.js';
import { useSendInput } from '../../hooks/sendInput.ts';
import { toastOnError } from '../../toasts.ts';
import { PositionIndicator } from '../../components/PositionIndicator.tsx';
import { ServerGame } from '../../hooks/serverGame.ts';
import SimulatedAgents from '../../components/SimulatedAgents.tsx'; 
import { mockAgents } from '../../../data/characters.js'
import { SimulatedAgent} from '@/components/createSimulatedAgentSprite'
import * as map from '../../../data/gentle.js';

export const PixiGame:React.FC<{
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  historicalTime: number | undefined;
  setSelectedElement: SelectElement;
  pixiWidth: number
  agentInfo: any,
  selectedAgentId: (id: number) => void
  onClearFEAgent:() => void
  clearSelectedAgentInfo:() => void
}> = ({
  worldId,
  engineId,
  game,
  historicalTime,
  setSelectedElement,
  agentInfo,
  pixiWidth,
  selectedAgentId,
  onClearFEAgent,
  clearSelectedAgentInfo,
}) => {
  // PIXI setup.
  const pixiApp = useApp();
  const viewportRef = useRef<Viewport | undefined>();
 
  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId: worldId }) ?? null;
  const humanPlayerId = [...game.world.players.values()].find(
    (p) => p.human === humanTokenIdentifier,
  )?.id;    
  


  const moveTo = useSendInput(engineId, 'moveTo');

  // Interaction for clicking on the world to navigate.
  const dragStart = useRef<{ screenX: number; screenY: number } | null>(null);
  const { width, height, tileDim } = game.worldMap;
  const players = [...game.world.players.values()];

  const onMapPointerDown = (e: any) => {
    // https://pixijs.download/dev/docs/PIXI.FederatedPointerEvent.html
    dragStart.current = { screenX: e.screenX, screenY: e.screenY };
    px2Positon()
  };

  const [lastDestination, setLastDestination] = useState<{
    x: number;
    y: number;
    t: number;
  } | null>(null);

  const agentsWeb: SimulatedAgent[] = mockAgents();






  const onMapPointerUp = async (e: any) => {
    
    if (dragStart.current) {
      const { screenX, screenY } = dragStart.current;
      dragStart.current = null;
      
      const [dx, dy] = [screenX - e.screenX, screenY - e.screenY];

     
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        console.log(`Skipping navigation on drag event (${dist}px)`);
        return;
      }
    }
    if (!humanPlayerId) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const gameSpacePx = viewport.toWorld(e.screenX, e.screenY);
    const gameSpaceTiles = {
      x: gameSpacePx.x / tileDim,
      y: gameSpacePx.y / tileDim,
    };
    setLastDestination({ t: Date.now(), ...gameSpaceTiles });
    const roundedTiles = {
      x: Math.floor(gameSpaceTiles.x),
      y: Math.floor(gameSpaceTiles.y),
    };
    console.log(`Moving to ${JSON.stringify(roundedTiles)}`);
    await toastOnError(moveTo({ playerId: humanPlayerId, destination: roundedTiles }));
  };
 

  useEffect(() => {
    if(agentInfo && agentInfo.position && viewportRef.current) {      
      const targetPosition = agentInfo.position
      const { x, y } = targetPosition
      viewportRef.current.animate({
        position: new PIXI.Point(x * tileDim,y * tileDim),
        scale: 1,
      })

      clearSelectedAgentInfo()
      
      // const list = [...players, ...agentsWeb]  
      // const focusPlayer = players.filter(p => p.id === agentInfo.playerId)
      // if(focusPlayer && !!focusPlayer.length) {
      //   const { x, y } = focusPlayer[0].position
      //   viewportRef.current.animate({
      //     position: new PIXI.Point(x * tileDim,y * tileDim),
      //     scale: 1,
      //   })
      // }
    }
  },[agentInfo])

  useEffect(() => {
    if(viewportRef.current) {
      viewportRef.current.animate({
        position: new PIXI.Point(map.mapwidth / 2 * tileDim, map.mapheight / 2 * tileDim),
        scale: 0.1,
      })
    }
    
  },[])

  // Zoom on the user's avatar when it is created
  useEffect(() => {
    if (!viewportRef.current || humanPlayerId === undefined) return;

    const humanPlayer = game.world.players.get(humanPlayerId)!;
    viewportRef.current.animate({
      position: new PIXI.Point(humanPlayer.position.x * tileDim, humanPlayer.position.y * tileDim),
      scale: 1.5,
    });
  }, [humanPlayerId]);


  const memoizedPositionIndicator = useMemo(() => {
    return lastDestination ? <PositionIndicator destination={lastDestination} tileDim={tileDim} /> : null;
  }, [lastDestination, tileDim]);

  const px2Positon = () => {
    const viewport = viewportRef.current;
    if(dragStart.current && viewport) {
      const { screenX, screenY } = dragStart.current;
       const gameSpacePx = viewport.toWorld(screenX, screenY);
         
       const gameSpaceTiles = {
         x: gameSpacePx.x / tileDim,
         y: gameSpacePx.y / tileDim,
       };
       return gameSpaceTiles
    }
  } 

 const h = 0.351595 * window.innerWidth


  return (
    <PixiViewport
      app={pixiApp} 
      screenWidth={ pixiWidth }
      screenHeight={h}
      worldWidth={width * tileDim}
      worldHeight={height * tileDim}
      viewportRef={viewportRef}
    >
      <PixiStaticMap
        map={game.worldMap}
        onpointerup={onMapPointerUp}
        onpointerdown={onMapPointerDown}
      />
  
      {memoizedPositionIndicator}
        {viewportRef.current && (
        <SimulatedAgents 
          container={viewportRef.current} 
          tileDim={tileDim} mapWidth={width}
          selectedAgentId={selectedAgentId}
        />
      )} 
      
      {
        players.map((p) => (
          <Player
            engineId={engineId}
            key={`player-${p.id}`}
            game={game}
            player={p}
            isViewer={p.id === humanPlayerId}
            onClick={setSelectedElement}
            historicalTime={historicalTime}
            onClearFEAgent={onClearFEAgent}
          />
        ))
      }
      {lastDestination && <PositionIndicator destination={lastDestination} tileDim={tileDim} />}
    </PixiViewport>
  )
}
