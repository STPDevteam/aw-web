import * as PIXI from 'pixi.js';
import { useApp } from '@pixi/react';
import { Player, SelectElement } from './Player.tsx';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { PixiStaticMap } from './PixiStaticMap.tsx';
import PixiViewport from './PixiViewport.tsx';
import { Viewport } from 'pixi-viewport';
import { Id } from '../../convex/_generated/dataModel';
import { useQuery, useMutation} from 'convex/react';
import { api } from '../../convex/_generated/api.js';
import { useSendInput } from '../hooks/sendInput.ts';
import { toastOnError } from '../toasts.ts';
import { DebugPath } from './DebugPath.tsx';
import { PositionIndicator } from './PositionIndicator.tsx';
import { SHOW_DEBUG_UI } from './Game.tsx';
import { ServerGame } from '../hooks/serverGame.ts';
import { useDebounceValue } from '../hooks/useDebounceValue.ts'

import SimulatedAgents from './SimulatedAgents'; 

const ZOOM = 0.8

export const PixiGame = (props: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  historicalTime: number | undefined;
  width: number;
  height: number;
  setSelectedElement: SelectElement;
}) => {
  // PIXI setup.
  const pixiApp = useApp();
  const viewportRef = useRef<Viewport | undefined>();
  const [visibleAgents, setVisibleAgents] = useState<any[]>([]);
  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId: props.worldId }) ?? null;
  const humanPlayerId = [...props.game.world.players.values()].find(
    (p) => p.human === humanTokenIdentifier,
  )?.id;    
  


  const moveTo = useSendInput(props.engineId, 'moveTo');


  // Interaction for clicking on the world to navigate.
  const dragStart = useRef<{ screenX: number; screenY: number } | null>(null);
  const { width, height, tileDim } = props.game.worldMap;
  const players = [...props.game.world.players.values()];



  const onMapPointerDown = (e: any) => {
    // https://pixijs.download/dev/docs/PIXI.FederatedPointerEvent.html
    dragStart.current = { screenX: e.screenX, screenY: e.screenY };
    // px2Positon()
  };

  const [lastDestination, setLastDestination] = useState<{
    x: number;
    y: number;
    t: number;
  } | null>(null);
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
 

  
  
  // Zoom on the user's avatar when it is created
  useEffect(() => {
    if (!viewportRef.current || humanPlayerId === undefined) return;

    const humanPlayer = props.game.world.players.get(humanPlayerId)!;
    viewportRef.current.animate({
      position: new PIXI.Point(humanPlayer.position.x * tileDim, humanPlayer.position.y * tileDim),
      scale: 1.5,
    });
  }, [humanPlayerId]);


  const memoizedPositionIndicator = useMemo(() => {
    return lastDestination ? <PositionIndicator destination={lastDestination} tileDim={tileDim} /> : null;
  }, [lastDestination, tileDim]);





  const memoizedPlayers = useMemo(() => {
    
    const {  engineId, game, setSelectedElement, historicalTime } = props
    return players.map((p) => (
      <Player
        engineId={engineId}
        key={`player-${p.id}`}
        game={game}
        player={p}
        isViewer={p.id === humanPlayerId}
        onClick={setSelectedElement}
        historicalTime={historicalTime}
      />
    ));
  }, [ props, humanPlayerId]);



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


  
  return (
    <PixiViewport
      app={pixiApp}
      screenWidth={props.width}
      screenHeight={props.height}
      worldWidth={width * tileDim}
      worldHeight={height * tileDim}
      viewportRef={viewportRef}
    >
      <PixiStaticMap
        map={props.game.worldMap}
        onpointerup={onMapPointerUp}
        onpointerdown={onMapPointerDown}
      />
      {/* {players.map(
        (p) =>
          // Only show the path for the human player in non-debug mode.
          (SHOW_DEBUG_UI || p.id === humanPlayerId) && (
            <DebugPath key={`path-${p.id}`} player={p} tileDim={tileDim} />
          ),
      )} */}
      {memoizedPositionIndicator}
      {viewportRef.current && (
        <SimulatedAgents container={viewportRef.current} tileDim={tileDim}/>
      )}
      {memoizedPlayers}
      {lastDestination && <PositionIndicator destination={lastDestination} tileDim={tileDim} />}
    </PixiViewport>
  );
};
export default PixiGame;
