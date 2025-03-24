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
import {  Box,  Text, Image } from '@chakra-ui/react'
import { AgentList } from '@/pages/Screen2/AgentList'
import { PixiGame } from './PixiGame'
import { selectedAgentInfo } from '@/redux/reducer'
import { useAppSelector } from '@/redux/hooks.ts'
import { PageLoading, BorderButton } from '@/components'
import { FEPlayerDetails } from './FEPlayerDetails'
import ReactDOM from 'react-dom';
import { Mouse1, Mouse2, Mouse3 } from '@/images'

export const mapContainerWidth = 1720
export const mapContainerHeight = 661
export const mapLeftWidth = 1145
export const mapRightWidth = 494

export const Game:React.FC<{ feAgentsInfo:any[] }>= ({  feAgentsInfo }) => {
  
  const [delayRender, setDelayRender] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  
  const [currentFEAgent, setCurrentFEAgent] = useState<any>()
  const [mapLoadingStatus, setMapLoadingStatus] = useState<'notStarted' | 'loading' | 'end'>('notStarted')

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
    const timer = setTimeout(() => {
      setDelayRender(true);
    }, 3000)
  
    return () => {
      clearTimeout(timer)
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
  const _h = 0.375531 * window.innerWidth 

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


  const welcomeText = () => (
    <Box  className='fx-col ai-ct' maxW="700px" >
      <Text fontWeight={400}  color='#838B8D'  className='fm3'  fontSize={['20px','20px','20px','24px','28px','32px']}>
        Welcome to AI Town
        </Text>
        <Text
          my={['30px','30px','30px','42px','48px','60px']}
          fontWeight={350} 
          fontSize={['14px','14px','14px','14px','14px','16px']}
          className='fm3'
          color='#838B8D'
        >
          <p>
            <span>Introducing the first-ever live demo of 1,000 AI agents running in real-time – our tribute to </span>
            <a className='gray click underline' href='https://github.com/joonspk-research/generative_agents' target='_blank'>Stanford Smallville</a> 
            <span> and </span>
            <a className='gray click underline' href='https://github.com/a16z-infra/ai-town'  target='_blank'>a16z AI Town</a>.
          </p>
          <p style={{ marginTop: '15px' }}>
            <span>Built in collaboration with our core AI contributor </span>
            <a className='gray click underline'  href='https://zhiqiangxie.com/'  target='_blank'>Zhiqiang Xie</a>
            <span> from Stanford University, this simulation brings his </span>
            <a className='gray click underline'  href='https://arxiv.org/abs/2411.03519'  target='_blank'>AI Metropolis</a>
            <span> paper to life, enabling massively multi-agent simulations while drastically reducing compute and inferencing costs.</span>

          </p>
          <p  style={{ marginTop: '15px' }}>
            <span>This is just the beginning – World.Fun is your launchpad to the Autonomous World era.</span>
          </p>
        </Text>
    </Box>
  )
  

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
      <Box pos='absolute' left="50px" top="44px" zIndex={99}  display={mapLoadingStatus === 'end' ? 'flex' : 'none'} > 
        <AgentList  worldId={worldId}/>
      </Box>         
        
      <Box maxW={`${mapContainerWidth}px`} className='map1_border_content w100 fx-row ai-ct jc-sb'>
        <Box
          w={_leftWidth}
          h={`${h}px`}
          className='center'  
          cursor={ mapLoadingStatus === 'end' ? 'all-scroll' : 'default'}
          pos='relative'
        > 
          <BorderBox >
              {
                 mapLoadingStatus !== 'end' && 
                <Box className='center h100 w100 fx-col ai-ct'>
                  { welcomeText() }
                  { mapLoadingStatus === 'notStarted' &&                       
                      <Box w="369px">
                        <BorderButton
                          isFixedWidth={true}
                          w={369}
                          h={58}
                          onClick={() => setMapLoadingStatus('loading')}
                          title="Launch 1,000-Agent AI Town"
                        />          
                      </Box>                
                  }
                  { mapLoadingStatus === 'loading' &&  
                    <PageLoading maxW={_leftWidth * 0.861326} onCompleted={p => setMapLoadingStatus(p === 1 ? 'end' : 'loading')} />
                  }
                </Box>
              }

              {
                delayRender &&  
                <Box 
                  className='box_clip20' 
                  h="calc(100% - 1px)" 
                  display={ mapLoadingStatus === 'end' ? 'block' : 'none'}
                >
                  {
                    guideOpen && 
                    <Box 
                      ref={newRef} 
                      onWheel={(e) => null}  
                      onClick={hideGuide} 
                      className=' box_clip click jc-sb fx-row ai-ct' 
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
              }          
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
          <Box p={['15px 6px','15px 6px','15px 6px','15px 6px','15px 6px','15px 20px',]} >
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


export const BorderBox:React.FC<{ children:React.ReactNode }> = ({ children }) => {
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
 
  h: number
}

const LoadingOverlay = ({ onCompleted, maxW, h}: LoadingOverlayProps): React.ReactPortal => {
  const portalContent = (   
      <Box 
        position="absolute"
        top={`calc(100% - ${h}px) `}
        // left="150px"
        zIndex={3}
        className='bd2 w100 center'
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