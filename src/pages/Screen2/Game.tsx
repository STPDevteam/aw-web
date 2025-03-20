import { useRef, useState, useEffect } from 'react';
import {  useElementSize, useResizeObserver } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from '../../components/PlayerDetails.tsx';
import { api } from '../../../convex/_generated/api';
import { useWorldHeartbeat } from '../../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../../hooks/useHistoricalTime.ts';
import { GameId } from '../../../convex/aiTown/ids.ts';
import { useServerGame } from '../../hooks/serverGame.ts';
import {  Box,  Grid, useBreakpointValue } from '@chakra-ui/react'
import { GameLeftBorder, GameRightBorder } from '@/images'
import { AgentList } from '@/pages/Screen2/AgentList'
import { PixiGame } from './PixiGame'
import { selectedAgentInfo } from '@/redux/reducer'
import { useAppSelector } from '@/redux/hooks.ts';



export const mapContainerWidth = 1720
export const mapContainerHeight = 661
export const mapLeftWidth = 1145
export const mapRightWidth = 494

export const Game = () => {
  const agentInfo = useAppSelector(selectedAgentInfo)

  
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();

  const debounceTime = 1000
  const responsiveOtherWidth = useBreakpointValue({
    base: mapContainerWidth / 2, 
    sm: mapContainerWidth / 2,
    md: mapContainerWidth / 2,
    lg: mapRightWidth + 64,
    xl: mapRightWidth + 64,
  });

  const otherWidth = mapRightWidth + 64 + 160 // 160 left nav width
  // const [pixiWidth, setPixiWidth] = useState<number>(window.innerWidth - otherWidth)

  const [pixiWidth, setPixiWidth] = useState<number>(() => {
  
    const containerWidth = Math.min(window.innerWidth, mapContainerWidth);
    return containerWidth - (responsiveOtherWidth || containerWidth / 2);
  });
    
 

  
 useEffect(() => {
  const updatePixiWidth = () => {
    const containerWidth = Math.min(window.innerWidth, mapContainerWidth);
    setPixiWidth(containerWidth - (responsiveOtherWidth || containerWidth / 2));
  };

  updatePixiWidth();

  let timeoutId: ReturnType<typeof setTimeout>;
  const handleResize = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      updatePixiWidth();
    }, debounceTime);
  };

  window.addEventListener('resize', handleResize);
  return () => {
    clearTimeout(timeoutId);
    window.removeEventListener('resize', handleResize);
  };
}, [debounceTime, responsiveOtherWidth]);



  const [gameWrapperRef, { width:mapWidth, height:mapHeight }] = useElementSize();


  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;

  const game = useServerGame(worldId)

 

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  if (!worldId || !engineId || !game) {
    return null;
  } 


  return (  
    <Box 
      className='box_clip fx-row ai-ct jc-sb w100' 
      bgColor="#1F1F23" 
      maxW={`${mapContainerWidth}px`} 
      h="706px"
      py="30px"
      px={['4px','4px','12px','24px','24px']}
      pos='relative'
    >
      <Box pos='absolute' left="50px" top="44px" zIndex={99}> 
        <AgentList  worldId={worldId}/>
      </Box> 
      <Grid 
        // borderWidth="2px"
        // borderStyle='solid'
        // borderColor={['red','green','yellow','blue','pink',]}
        maxW={`${mapContainerWidth}px`}
        className='w100'
        templateColumns={['1fr 1fr','1fr 1fr','1fr 1fr','1fr 1fr','11.45fr 4.94fr']}>
        <Box
          bgImage={GameLeftBorder}
          bgSize="cover"
          bgPosition='center'
          bgRepeat="no-repeat"  
          // w={`${mapLeftWidth}px`}
          w="100%"
          h={`${mapContainerHeight}px`}
          className='box_clip screen2-map-container'  
          cursor='all-scroll'
        > 
            <Stage width={pixiWidth} height={mapContainerHeight} options={{ backgroundColor: '#1F1F23' }}>
              <ConvexProvider client={convex}>
                <PixiGame
                  pixiWidth={pixiWidth}
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
          w="100%"
          h={`${mapContainerHeight}px`}
          className='fx jc-ct'
          overflowY="scroll"
          onWheel={(e) => e.stopPropagation()} 
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


      </Grid>
    </Box>
  );
}
