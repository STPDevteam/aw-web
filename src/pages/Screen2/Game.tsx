import { useRef, useState } from 'react';
import {  useElementSize, useResizeObserver } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from '../../components/PlayerDetails.tsx';
import { api } from '../../../convex/_generated/api';
import { useWorldHeartbeat } from '../../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../../hooks/useHistoricalTime.ts';
import { GameId } from '../../../convex/aiTown/ids.ts';
import { useServerGame } from '../../hooks/serverGame.ts';
import {  Box,  } from '@chakra-ui/react'
import { GameLeftBorder, GameRightBorder } from '@/images'
import { AgentList } from '@/pages/Screen2/AgentList'
import { PixiGame } from './PixiGame'

import { selectedAgentInfo } from '@/redux/reducer'
import { useAppSelector } from '@/redux/hooks.ts';


export const Game = () => {
  const agentInfo = useAppSelector(selectedAgentInfo)
  
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();


  const [gameWrapperRef, { width:mapWidth, height:mapHeight }] = useElementSize();


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


  const width = 1161
  const height = 661


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
          <Stage width={width} height={height} options={{ backgroundColor: '#1F1F23' }}>
            <ConvexProvider client={convex}>
              <PixiGame
                agentInfo={agentInfo}
                game={game}
                worldId={worldId}
                engineId={engineId}
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
