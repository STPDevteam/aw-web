import { useRef, useState } from 'react';
import PixiGame from './PixiGame.tsx';
import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from './PlayerDetails.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';
import {  Box,  } from '@chakra-ui/react'
import { GameLeftBorder, GameRightBorder } from '@/images'
import { AgentList } from '@/pages/Screen2/AgentList'
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

  const mapWidth = 1161
  const mapHeight = 661

  return (  
    <Box 
      className='box_clip fx-row ai-ct jc-sb' 
      bgColor="#1F1F23" 
      w="1720px" 
      h="706px"
      py="30px"
      px="24px"        
      pos='relative'
    >
      <Box pos='absolute' left="50px" top="44px" zIndex={99}> 
        <AgentList  worldId={worldId}/>
      </Box> 
      <Box
        bgImage={GameLeftBorder}
        bgSize="cover"
        bgPosition='center'
        bgRepeat="no-repeat"  
        w="1161px"
        h="661px"
        className='box_clip'
        
      > 
          <Stage width={mapWidth} height={mapHeight} options={{ backgroundColor: '#1F1F23' }}>
            <ConvexProvider client={convex}>
              <PixiGame
                game={game}
                worldId={worldId}
                engineId={engineId}
                width={mapWidth}
                height={mapHeight}
                historicalTime={historicalTime}
                setSelectedElement={setSelectedElement}
              />
            </ConvexProvider>
          </Stage>  
      </Box>
      <Box
        bgImage={GameRightBorder}
        bgSize="cover"
        bgPosition='center'
        bgRepeat="no-repeat"  
        w="494px"
        h="661px"
        className='fx jc-ct'
      >       
        <PlayerDetails
          worldId={worldId} 
          engineId={engineId}
          game={game}
          playerId={selectedElement?.id}
          setSelectedElement={setSelectedElement}
          scrollViewRef={scrollViewRef}
        />
      </Box>
    </Box>
  );
}
