import { useRef, useState } from 'react';
import PixiGame from './PixiGame.tsx';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from './PlayerDetails.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';
import logoImg from '../../assets/ui/logo.png';

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;

export default function Game() {
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [gameWrapperRef, { width, height }] = useElementSize();

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;

  const game = useServerGame(worldId);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  if (!worldId || !engineId || !game) {
    return null;
  }


  // grid-cols-[0.69fr_0.31fr] lg:grid-cols-[0.69fr_0.31fr] 
  return (  
    < >
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <div className=' lg:grow max-w-[1800px] mx-auto w-full max-w grid lg:grid-cols-[1fr_auto] lg:grow' style={{ zIndex: 2,position:'relative', width: '100%', display: 'flex', gridTemplateColumns: '6.92fr 3.08fr',flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* <div /> */}
      
        {/* <div className='' style={{ marginRight: '5%' }}>
          <img src={logoImg} style={{  width: '390px', height: '153px'}}/>
        </div>  */}
      </div>
      <div  style={{ display: 'grid', gridTemplateColumns: '6.92fr 3.08fr', width: '100%', marginTop: '-75px', }} 
        className="  mx-auto w-full max-w grid lg:grid-cols-[1fr_auto] lg:grow max-w-[1800px] min-h-[480px] game-frame">
        {/* Game area */}

        <div className='' style={{ display: 'flex', alignItems: 'center', justifyContent:'center', position: 'relative', zIndex: -1, }}>
          <div className=" overflow-hidden"  style={{ height: '90%',  width: '94%', position: 'relative', zIndex: -1,  }} ref={gameWrapperRef} >
              <Stage width={width} height={height } options={{ backgroundColor: 0x7ab5ff }}>
                <ConvexProvider client={convex}>
                  <PixiGame
                    game={game}
                    worldId={worldId}
                    engineId={engineId}
                    width={width}
                    height={height}
                    historicalTime={historicalTime}
                    setSelectedElement={setSelectedElement}
                  />
                </ConvexProvider>
              </Stage>          
          </div> 
        </div>
        
        {/* Right column area */}
        <div
          className=" flex flex-col  overflow-y-auto shrink-0 px-4 py-6 sm:px-6 lg:w-96 xl:pr-6 text-brown-100"
          ref={scrollViewRef}
          style={{ zIndex: 2, height: '90%' }}
        >
          <PlayerDetails
            worldId={worldId}
            engineId={engineId}
            game={game}
            playerId={selectedElement?.id}
            setSelectedElement={setSelectedElement}
            scrollViewRef={scrollViewRef}
          />
        </div>
      </div>      
    </>
  );
}
