import { useRef, useState, useEffect, useMemo, } from 'react';
import {  useElementSize, useResizeObserver } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from '../../components/PlayerDetails.tsx';
import { api } from '../../../convex/_generated/api';
import { useWorldHeartbeat } from '../../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../../hooks/useHistoricalTime.ts';
import {  GameId } from '../../../convex/aiTown/ids.ts';
import { useServerGame } from '../../hooks/serverGame.ts';
import {  Box,  Text, Image, Button} from '@chakra-ui/react'
import { AgentList } from '@/pages/Screen2/AgentList'
import { PixiGame } from './PixiGame'
import { selectedAgentInfo, selectedAgentInfoAction } from '@/redux/reducer'
import { useAppDispatch, useAppSelector } from '@/redux/hooks.ts'
import { PageLoading, BorderButton } from '@/components'
import { FEPlayerDetails } from './FEPlayerDetails'
import { Mouse1, Mouse2, Mouse3, Search} from '@/images'
import { SearchAgents } from './SearchAgents'

export const mapContainerWidth = 1720
export const mapContainerHeight = 661
export const mapLeftWidth = 1145
export const mapRightWidth = 494

export const Game:React.FC<{ feAgentsInfo:any[]}>= ({  feAgentsInfo }) => {
  
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')

  const [agentInfoVisible, setAgentInfoVisible] = useState(false)
  // const [delayRender, setDelayRender] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  
  const [currentFEAgent, setCurrentFEAgent] = useState<any>()
  const [mapLoadingStatus, setMapLoadingStatus] = useState<'notStarted' | 'loading' | 'end'>('end')

  const agentInfo = useAppSelector(selectedAgentInfo)
  const dispatch = useAppDispatch()
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>
  }>()
  const scrollViewRef = useRef<HTMLDivElement>(null)

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;


  const game = useServerGame(worldId)
  

  useWorldHeartbeat();
  
//   const memoizedFeDetail = useMemo(() => {
//     return currentFEAgent ? <FEPlayerDetails currentFEAgent={currentFEAgent} onClearFEAgent={() => setCurrentFEAgent(null)}/>  : null;
// }, [currentFEAgent]);

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  
  const list = useQuery(api.aiTown.game.getAllAgentsPublic, worldId ? { worldId,sortBy: 'name' } : 'skip');


  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);
  
  const newRef = useRef<HTMLDivElement | null>(null)





  function handleClickOutside(event:MouseEvent) {
    if (guideOpen && newRef.current && event.target instanceof Node && !newRef.current.contains(event.target)) {
      hideGuide()
    }
  }

  function hideGuide() {

    setGuideOpen(false)
    localStorage.setItem('guide_page_alive','no')
  }

  useEffect(() => {    
    document.addEventListener("mousedown", handleClickOutside)
   
  
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if(mapLoadingStatus === 'end') {
      const guide_page_alive = localStorage.getItem('guide_page_alive')
      if(!!!guide_page_alive) {
        setGuideOpen(true)
      }
    }

  
  },[mapLoadingStatus])



  if (!worldId || !engineId || !game) {
    return null;
  } 

  const h = 0.351595 * window.innerWidth > 661 ? 661 : 0.351595 * window.innerWidth

  const _leftWidth = h / 0.56933 
  const _rightWidth = 0.262765 * window.innerWidth 
  const _w =  0.914893 * window.innerWidth 

  const ___rightWidth = _rightWidth > 494 ? 494 : _rightWidth

  const selectedFEAgentId = (id: number) => {
   
    const targetAgent = feAgentsInfo.filter(item => item.frontendAgentId === id)
    if(targetAgent) {
      setCurrentFEAgent(targetAgent[0])
    }
  }  
  const onClickAgent = (p:any) => {
    if(p) {
      setSelectedPlayerId(p.id)
      setAgentInfoVisible(true)
    }

  }

  return (  
    <Box 
      className=' ' 
      bgColor="#000"
      pos='relative'
      h="100vh"
      w="100vw"
    >
      <Box pos='absolute' right="0px" bottom="240px" zIndex={2}> 
        {
          !agentInfoVisible && 
          <Button className='fx-row ai-ct click jc-sb click' w="120px" h="64px" px="20px" onClick={() => setAgentInfoVisible(true)}>
              <Image src={Search} h="20px" w="20px" />
              <Text color="#000000" fontSize="14px" ml="12px" fontWeight={700}>Search</Text>
          </Button>
        }
      </Box>     

      {
        agentInfoVisible && (
          <Box 
            className=''
            zIndex={2}
            h="90%"
            w="400px"
            pos='absolute' 
            right="9px" 
            bottom="20px"
            overflowY="scroll"
            onWheel={(e) => e.stopPropagation()} 
          >
            { list && !!list.length && 
              <SearchAgents 
                selectedPlayerId={selectedPlayerId} 
                scrollViewRef={scrollViewRef} 
                engineId={engineId} 
                worldId={worldId}  
                agentList={list} 
                game={game} 
                onFold={() => {
                  setAgentInfoVisible(false)
                  setSelectedPlayerId('')
                }}
              />}
            
            {/* <PlayerDetails
              worldId={worldId} 
              engineId={engineId}
              game={game}
              playerId={selectedElement?.id}
              setSelectedElement={setSelectedElement}
              scrollViewRef={scrollViewRef}
              onClearFEAgent={() => setCurrentFEAgent(null)}
            /> */}
          </Box>                  
        )
      }
    


      <Box        
        className='center h100 w100'  
        cursor={ mapLoadingStatus === 'end' ? 'all-scroll' : 'default'}
        pos='relative'
      > 
        
        {
          // delayRender &&  
          <Box display={ mapLoadingStatus === 'end' ? 'block' : 'none'}>
            {
              guideOpen &&  
              <Box 
                ref={newRef} 
                onWheel={(e) => null}  
                onClick={hideGuide} 
                className='  click jc-sb fx-row ai-ct' 
                bgColor="rgba(0,0,0,0.8)" 
                w="100%"
                h="100%"
                pos='absolute'                   
                px={['90px','90px','90px','126px','144px','180px']}
              >
                <Box className='fx-col ai-ct '>
                  <Box className='fx-row ai-ct'>
                    <Image src={Mouse1} w={['35px','35px','35px','49px','56px','71px',]} h={['55px','55px','55px','77px','88px','111px']}/>
                    <Image src={Mouse2} w={['38px','38px','38px','53px','60px','76px',]} h={['38px','38px','38px','53px','60px','76px']} ml={['15px','15px','15px','21px','24px','30px']} />
                  </Box>
                  <Text className='fm2' mt="30px" color='#E0E0E0' fontWeight={350} fontSize={['14px','14px','14px','14px','14px','16px']}>Hold left-click and drag to move the map</Text>
                </Box>  

                <Box className='fx-col ai-ct '>
                  <Image src={Mouse3} w={['35px','35px','35px','49px','56px','71px',]} h={['55px','55px','55px','77px','88px','111px']}/>
                  <Text className='fm2' mt="30px" color='#E0E0E0' fontWeight={350} fontSize={['14px','14px','14px','14px','14px','16px']}>Scroll to zoom in/out on the map</Text>
                </Box>              
              </Box>
            }

            <Stage width={window.innerWidth } height={window.innerHeight} options={{ backgroundColor: '#1F1F23' }}>
              <ConvexProvider client={convex}>
                <PixiGame
                  selectedAgentId={selectedFEAgentId}
                  pixiWidth={window.innerWidth}
                  agentInfo={agentInfo}
                  game={game}
                  worldId={worldId}
                  engineId={engineId}
                  historicalTime={historicalTime}
                  setSelectedElement={setSelectedElement}
                  onClickAgent={onClickAgent}
                  clearSelectedAgentInfo={() => dispatch(selectedAgentInfoAction(null))}
                />
              </ConvexProvider>
            </Stage>  
          </Box>
        }          
      </Box>
              
      

    </Box>
  );
}


export const BorderBox:React.FC<{ children:React.ReactNode }> = ({ children }) => {
  return (
    <Box className='map2_border w100 h100'>
      <Box  className='map2_border_content w100 h100' p={['4px','4px','4px','6px','6px','10px']}>
        <Box className='map2_border w100 h100'>
          <Box className='map2_border_content w100 h100' overflowY="scroll"> 
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}


