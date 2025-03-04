import * as PIXI from 'pixi.js';
import { useApp } from '@pixi/react';
import { Player, SelectElement } from './Player.tsx';
import { useEffect, useRef, useState, useMemo} from 'react';
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


const ZOOM = 1.2

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



  // const updateVisibleAgents = useMutation(api.aiTown.updateVisibleAgents.updateVisibleAgents)
  
 

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
      scale: ZOOM,
    });
  }, [humanPlayerId]);

 

//   const computedVisibleAgentIds = useMemo(() => {

    
//     const viewport = viewportRef.current;

//     if(viewport) {
    
//       const x =  Math.abs(viewport.position.x) 
//       const y =  Math.abs(viewport.position.y) 
//       const viewableAreaWidth = viewport.worldScreenWidth  / tileDim / ZOOM
//       const viewableAreaHeight = viewport.worldScreenHeight / tileDim / ZOOM
   
      

//       const gameSpaceTiles = {
//         x: x / tileDim / ZOOM,
//         y: y / tileDim / ZOOM,
//       };

    

//       const visiblePlayers = players.filter((player) => {
//         const { x: X, y: Y } = player.position;
//         return X > gameSpaceTiles.x && X < (gameSpaceTiles.x + viewableAreaWidth)  && Y > gameSpaceTiles.y && Y < (gameSpaceTiles.y + viewableAreaHeight);
//       });
      
//       const idsList = visiblePlayers.map(item => item.id) 
//       // console.log('idsList',  idsList)
//       const agents = [...props.game.world.agents.values()]
      
//       return agents
//         .filter(agent => visiblePlayers.some(p => p.id === agent.playerId))
//         .map(agent => agent.id);

//     }


//   }, [props.game.world.agents]);  // players, 


//   const debouncedVisibleAgentIds = useDebounceValue(computedVisibleAgentIds, 3000);


//   useEffect(() => {
    

   
//     if (computedVisibleAgentIds && !!computedVisibleAgentIds.length) {
//       updateVisibleAgents({ agentIds: computedVisibleAgentIds });
//     }
//   }, [computedVisibleAgentIds]);




// useEffect(() => {
//   if (viewportRef.current) {

//     viewportRef.current.animate({
//       position: {x: 20 * tileDim,y: 26 * tileDim},
//       scale: ZOOM,
//     });  
//     viewportRef.current.plugins.remove('wheel');
//     viewportRef.current.plugins.remove('pinch');
//   } 
// }, []);

// const px2Positon = () => {
//   const viewport = viewportRef.current;
//   if(dragStart.current && viewport) {
//     const { screenX, screenY } = dragStart.current;
//      const gameSpacePx = viewport.toWorld(screenX, screenY);
       
//      const gameSpaceTiles = {
//        x: gameSpacePx.x / tileDim,
//        y: gameSpacePx.y / tileDim,
//      };
//      return gameSpaceTiles
//   }
// }





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
      {players.map(
        (p) =>
          // Only show the path for the human player in non-debug mode.
          (SHOW_DEBUG_UI || p.id === humanPlayerId) && (
            <DebugPath key={`path-${p.id}`} player={p} tileDim={tileDim} />
          ),
      )}
      {lastDestination && <PositionIndicator destination={lastDestination} tileDim={tileDim} />}
      {
      players.map((p) => (
        <Player
          engineId={props.engineId}
          key={`player-${p.id}`}
          game={props.game}
          player={p}
          isViewer={p.id === humanPlayerId}
          onClick={props.setSelectedElement}
          historicalTime={props.historicalTime}
        />
      ))}
    </PixiViewport>
  );
};
export default PixiGame;
