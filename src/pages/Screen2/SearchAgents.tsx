import React, { useState,FC, useEffect } from 'react'
import { Box, Text, Image } from '@chakra-ui/react'
import { Search, Back, LowBattery, Fold, ZZZ } from '@/images'
import { FEPlayerDetails } from './FEPlayerDetails'
import { ServerGame } from '@/hooks/serverGame';
import { motion } from 'framer-motion';
import { Id } from '../../../convex/_generated/dataModel'

const MotionImage = motion(Image);

interface iSearchAgents {
    agentList: any[]
    game: ServerGame
    onFold:() => void
    worldId:any
    engineId: Id<'engines'>
    scrollViewRef: React.RefObject<HTMLDivElement>
    selectedPlayerId: string
}
export const SearchAgents:FC<iSearchAgents> = ({ agentList, game, onFold, worldId, engineId, scrollViewRef, selectedPlayerId }) => {  
    const [isHover, setHover] = useState<boolean>(false)
    const [isDetail, setDetail] = useState<boolean>(false)
    const [keyword, setKeyword] = useState<string>('')
    const [currentFEAgent, setCurrentFEAgent] = useState<any>()
    const [filteredList, setFilteredList] = useState<any[]>([])

    // const a = agentList.filter(item => item.energy < 21)
    // console.log('aa', a)
    useEffect(() => {   
        if(selectedPlayerId) {
            const taegetAgent = agentList.find(item => item.playerId === selectedPlayerId)
            if(taegetAgent) {
                setCurrentFEAgent(taegetAgent)
                setDetail(true)
            }
            
        }
    },[selectedPlayerId])
    useEffect(() => {
        filterList()
    },[keyword])
    const filterList = () => {
        if(keyword) {            
            const reg = new RegExp(keyword, 'i')
            const res = agentList.filter(item => reg.test(item.name))
            setFilteredList(res)

        }else {
            setFilteredList([])
            setDetail(false)
        }   
    }
    const onChange = (e:any) => {
        const v = e.target.value
        setKeyword(v)
    }

    const onBack = () => {
        setDetail(false)
    }
    const onItem = (item: any) => {
        setDetail(true) 
        setCurrentFEAgent(item)

    }
    const onDetailSearch = () => {}

    return(
        <Box h={window.innerHeight * 0.7822 } className='' onMouseOver={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            <Box 
                h="64px" 
                className='w100 fx-row ai-ct jc-sb' 
                px="12px"
                borderRadius="10px"
                bgColor="rgba(255,255,255, 0.6)"                   
            >
                <Image src={isDetail ? Back : Search} h='20px' w='20px' className='click' onClick={isDetail ? () => onBack() : () => null}/>
                { isDetail &&  <Box h="23px" w="1px" bgColor="#fff" mx="12px"/>}
                
                <input 
                    placeholder='Search by Agent Name'
                    value={keyword} 
                    onChange={onChange} 
                    className=' agent_search_input'
                    style={{
                        width: 'calc(100% - 40px - 24px - 25px)'
                    }}/>
                {
                    isDetail ? <Image src={Search} h='20px' w='20px' className='click' onClick={onDetailSearch}/> : <Box w='20px' h='20px'/>
                }
            </Box>       
            
            <Box 
                overflowY="scroll" 
                className=' fx-col ai-ct h100 '  
                mt="10px"    
                backdropFilter="blur(10px)"  
                bgColor='#C5C7BE'
                borderRadius="10px"
        
                >
                    <Box className='w100 h100' >
                        {
                            !isDetail ?
                            <Box className='w100 h100' px="7px">
                                {
                                    !!filteredList.length ? filteredList.map((item:any) => (
                                        <Box mt="8px"  key={item.name}  onClick={() => onItem(item)}>
                                            <AgentItem item={item}/>
                                        </Box>
                                    )): 
                                    <Box className='h100 w100 center '>
                                        <Text color='#000' fontSize="14px" fontWeight={600}>Search Result</Text>
                                    </Box> 
                                }
                            </Box> : 
                            <FEPlayerDetails 
                                scrollViewRef={scrollViewRef}
                                worldId={worldId} 
                                engineId={engineId} 
                                game={game} 
                                currentFEAgent={currentFEAgent} 
                                onClickAgent={() => setCurrentFEAgent(null)}/>

                        }
                    </Box>
            </Box> 
            {
                isHover && (
                    <MotionImage
                      src={Fold}
                      w="32px"
                      h="32px"
                      pos="absolute"
                      right="10px"
                      top="224px"
                      className="click"
                      onClick={onFold}
                      initial={{ opacity: 0, x: 20 }}  
                      animate={{ opacity: 1, x: 0 }}   
                      exit={{ opacity: 0, x: 20 }}  
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  )
            }
        </Box>
    )
}


interface iAgentItem {
   item:any
}
export const AgentItem:FC<iAgentItem> = ({
    item
}) => {
    const isLowBattery = item.energy < 20 && item.energy > 0
    const isSleeping = item.energy === 0
    const isActity = item.energy >= 20




    const style = {
        isLowBattery: {
            bg: 'linear-gradient(to right, #E7E5DE 0%,#E1E3DF 45%, #C3827D 100%)',
            progress: 'linear-gradient(to right, #F8ED7E, #E77C46)',
            icon: LowBattery
        },
        isSleeping: {
            bg: '#C2D0DD',
            progress: 'rgba(0,0,0,0.1)',
            icon: ZZZ
        },
        isActity: {
            bg: 'rgba(255, 255, 255, 0.5)',
            progress: 'linear-gradient(to right, #C4F77E, #46B6E7)',
            icon: null
        },

    }
    const currentStyle = isLowBattery ? style.isLowBattery : isSleeping ? style.isSleeping : style.isActity;



    return (
        <Box           
            className=' fx-row ai-ct jc-sb w100 click'  
            pos='relative'
            px="13px"
            py="10px"
            borderRadius="10px" 
            bg={currentStyle.bg}
        >
            <Box  className='fx-row ai-ct w100'>
                {/* logo */}
                <Image src={item.avatarUrl} w="68px" h="68px" border="4px solid rgba(255,255,255,0.6)" borderRadius="50%"/>
                {/* info */}
                <Box  className='fx-col w100 ' ml="11px"> 
                    <Box className='fx-row ai-ct jc-sb'>
                        <Text fontSize='20px' color='#000' fontWeight={700}>{item.name}</Text>
                        <div/>
                    </Box>

                    <Box className='fx-row ai-ct jc-sb w100'>
                        <Box className='fx-row ai-ct jc-sb '>
                            <Box className='fx-col' >
                                <Text fontSize="14px" color='rgba(83, 92, 95, 1)'>Inferences</Text>
                                <Text fontSize='14px' color='#000' fontWeight={700}>{item.inferences}</Text>
                            </Box>
                        </Box>

                        <Box w="1px" h="33px" bgColor="#fff"/>
                        <Box className=''>
                            <Text fontSize="14px" color='rgba(83, 92, 95, 1)'>Power</Text>
                            <Box w="152px" bgColor='#C5C5C5' h='14px' borderRadius='10px' mt="5px">
                                <Box w={`${item.energy}%`} h='100%' borderRadius='10px' bg={currentStyle.progress}/>
                            </Box>
                        </Box>
                    </Box>

                </Box>
            </Box>    
            {
                currentStyle.icon && <Image src={currentStyle.icon} w='24px' h='24px' pos='absolute' top='10px' right='12px'/>
            }
        </Box>
    )
}
