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
import { useAppSelector } from '@/redux/hooks.ts'
import { PageLoading } from '@/components'



export const mapContainerWidth = 1720
export const mapContainerHeight = 661
export const mapLeftWidth = 1145
export const mapRightWidth = 494

export const Game = () => {
  const [pageProgress, setPageProgress] = useState<number>(0)

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

  const game = useServerGame(worldId)

 

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  if (!worldId || !engineId || !game) {
    return null;
  } 


  
  // 1880

  const h = 0.351595 * window.innerWidth > 661 ? 661 : 0.351595 * window.innerWidth
  const _h = 0.375531 * window.innerWidth 
  

  const _leftWidth = h / 0.56933 
  // 494 / 1880 = 0.262765
  const _rightWidth = 0.262765 * window.innerWidth 
  // 1720 / 1880 = 0.914893
  const _w =  0.914893 * window.innerWidth 

  const ___rightWidth = _rightWidth > 494 ? 494 : _rightWidth


 
  // display={isActive ? 'block' : 'none'}

  // 1161 / 661  0.56933
  return (  
    <Box 
      className='box_clip fx-row ai-ct jc-sb ' 
      // w={_w > 1720 ? "1720px" : `${_w}px` }
      w='100%'
      bgColor="#1F1F23" 
      maxW={`${mapContainerWidth}px`} 
      h={_h > 706 ? "706px" : `${_h}px`}
      py="30px"
      px={['4px','4px','12px','24px','24px']}
      pos='relative'
    >
      <Box pos='absolute' left="50px" top="44px" zIndex={99}> 
        <AgentList  worldId={worldId}/>
      </Box>         
        
        <Box maxW={`${mapContainerWidth}px`} className='w100 fx-row ai-ct jc-sb'>
            <Box
              bgImage={GameLeftBorder}
              bgSize="cover"
              bgPosition='center'
              bgRepeat="no-repeat"  
              w={_leftWidth}
              h={`${h}px`}
              className='box_clip center'  
              cursor='all-scroll'
              pos='relative'
            > 
              <Box 
                className='w100 '  
                pos='absolute'
                left="0"
                top="50%"
                transform='-50% -50%'
                zIndex={9999}
                pointerEvents="none" 
                display={pageProgress < 1 ? 'block' : 'none'} 
                style={{ willChange: "opacity, transform", transform: "translateZ(0)" }}
              >
                <PageLoading maxW={_leftWidth * 0.861326} onCompleted={p => setPageProgress(p)}/>
              </Box>  
              <Box 
                display={pageProgress === 1 ? 'flex' : 'none'} 
                className=''
                position="absolute"
                top="0"
                left="0"
                width="100%"
                height="100%"
                zIndex={1}
              >
                <Stage width={_leftWidth } height={h} options={{ backgroundColor: '#1F1F23' }}>
                  <ConvexProvider client={convex}>
                    <PixiGame
                      pixiWidth={_leftWidth}
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
            </Box>
            <Box
              bgImage={GameRightBorder}
              bgSize="cover"
              bgPosition='center'
              bgRepeat="no-repeat"  
              w={___rightWidth}
              h={`${h}px`}
              className='fx jc-ct'
              overflowY="scroll"
              onWheel={(e) => e.stopPropagation()} 
            >       
              <PlayerDetails
                width={___rightWidth * 0.85}
                worldId={worldId} 
                engineId={engineId}
                game={game}
                playerId={selectedElement?.id}
                setSelectedElement={setSelectedElement}
                scrollViewRef={scrollViewRef}
              />
            </Box>
        </Box>
    </Box>
  );
}
