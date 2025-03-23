import { useRef, useState, useEffect, useMemo } from 'react';
import {  useElementSize, useResizeObserver } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from '../../components/PlayerDetails.tsx';
import { api } from '../../../convex/_generated/api';
import { useWorldHeartbeat } from '../../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../../hooks/useHistoricalTime.ts';
import {  GameId } from '../../../convex/aiTown/ids.ts';
import { useServerGame } from '../../hooks/serverGame.ts';
import {  Box,  Grid, useBreakpointValue } from '@chakra-ui/react'
import { AgentList } from '@/pages/Screen2/AgentList'
import { PixiGame } from './PixiGame'
import { selectedAgentInfo } from '@/redux/reducer'
import { useAppSelector } from '@/redux/hooks.ts'
import { PageLoading } from '@/components'
import { FEPlayerDetails } from './FEPlayerDetails'
import ReactDOM from 'react-dom';


export const mapContainerWidth = 1720
export const mapContainerHeight = 661
export const mapLeftWidth = 1145
export const mapRightWidth = 494

export const Game:React.FC<{  currentIndex: number, feAgentsInfo:any[] }>= ({ currentIndex, feAgentsInfo }) => {
  
  const [pageProgress, setPageProgress] = useState<number>(0)
  const [currentFEAgent, setCurrentFEAgent] = useState<any>()

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
  const memoizedFeDetail = useMemo(() => {
    return currentFEAgent ? <FEPlayerDetails currentFEAgent={currentFEAgent} onClearFEAgent={() => setCurrentFEAgent(null)}/>  : null;
}, [currentFEAgent]);

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


  const selectedFEAgentId = (id: number) => {
   
    const targetAgent = feAgentsInfo.filter(item => item.frontendAgentId === id)
    if(targetAgent) {
      setCurrentFEAgent(targetAgent[0])
    }
  }


 

  return (  
    <Box 
      className='map1_border fx-row ai-ct jc-sb ' 
      w='100%'
      maxW={`${mapContainerWidth}px`} 
      h={_h > 706 ? "706px" : `${_h}px`}
      py="30px"
      px={['4px','4px','12px','24px','24px']}
      pos='relative'
      // borderWidth="2px"
      // borderStyle='solid'
      // borderColor={['red','green','yellow','blue','red','pink',]}
    >
      <Box pos='absolute' left="50px" top="44px" zIndex={99}  display={pageProgress === 1 ? 'flex' : 'none'} > 
        <AgentList  worldId={worldId}/>
      </Box>         
        
      <Box  maxW={`${mapContainerWidth}px`} className='map1_border_content w100 fx-row ai-ct jc-sb'>
        <Box
          w={_leftWidth}
          h={`${h}px`}
          className=' center'  
          cursor='all-scroll'
            pos='relative'
        > 
ß         {pageProgress < 1 &&  currentIndex === 1 &&

              <LoadingOverlay h={h} w={`${___rightWidth}px`} maxW={_leftWidth * 0.861326} onCompleted={p => setPageProgress(p)} />
          }
        
            <BorderBox  >
              <Box display={pageProgress === 1 ? 'flex' : 'none'} >
              
                <Stage width={_leftWidth } height={h} options={{ backgroundColor: '#1F1F23' }}>
                  <ConvexProvider client={convex}>
                    <PixiGame
                      selectedAgentId={selectedFEAgentId}
                      pixiWidth={_leftWidth}
                      agentInfo={agentInfo}
                      game={game}
                      worldId={worldId}
                      engineId={engineId}
                      historicalTime={historicalTime}
                      setSelectedElement={setSelectedElement}
                      onClearFEAgent={() => setCurrentFEAgent(null)}
                    />
                  </ConvexProvider>
                </Stage>  
              </Box>         
            </BorderBox>

          
        </Box>
        
        <Box
          w={___rightWidth}
          h={`${h}px`}
          className='fx jc-ct'
          overflowY="scroll"
          onWheel={(e) => e.stopPropagation()} 
        >      
        <BorderBox>
          <Box p="15px 20px">
            {
              currentFEAgent ? 
              <>{memoizedFeDetail}</>: 
              <PlayerDetails
                worldId={worldId} 
                engineId={engineId}
                game={game}
                playerId={selectedElement?.id}
                setSelectedElement={setSelectedElement}
                scrollViewRef={scrollViewRef}
                onClearFEAgent={() => setCurrentFEAgent(null)}
              />
            }
          </Box>
        </BorderBox>        
        </Box>
      </Box>
    </Box>
  );
}


const BorderBox:React.FC<{ children:React.ReactNode }> = ({ children }) => {
  return (
    <Box className='map2_border w100 h100'>
      <Box  className='map2_border_content w100 h100' p="10px">
        <Box className='map2_border w100 h100'>
          <Box className='map2_border_content w100 h100' overflowY="scroll"> 
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}


interface LoadingOverlayProps {
  onCompleted: (p: number) => void;
  maxW: number;
  w:  string;
  h: number
}

const LoadingOverlay = ({ onCompleted, maxW, w, h}: LoadingOverlayProps): React.ReactPortal => {
  const portalContent = (   
      <Box 
        position="absolute"
        top={(h+128) / 2}
        left={"150px"}
        zIndex={3}
      >
        <PageLoading maxW={maxW} onCompleted={onCompleted} />
      </Box>    
  );

  return ReactDOM.createPortal(
    // @ts-ignore
    portalContent as unknown as React.ReactElement,
    document.body
  ) as unknown as React.ReactPortal;
};