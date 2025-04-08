import React, { useState,FC } from 'react'
import { Box, Text, Image } from '@chakra-ui/react'
import { Search, Back, LowBattery } from '@/images'
import { FEPlayerDetails } from './FEPlayerDetails'
import { ServerGame } from '@/hooks/serverGame';

interface iSearchAgents {
    agentList: any[]
    game: ServerGame
}
export const SearchAgents:FC<iSearchAgents> = ({ agentList, game }) => {  
    
    const [isDetail, setDetail] = useState<boolean>(false)
    const [keyword, setKeyword] = useState<string>('')
    const [currentFEAgent, setCurrentFEAgent] = useState<any>()
    
    
    // console.log('agentList', agentList)

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
    return(
        <Box h={window.innerHeight * 0.7822 } className=''>
            {/* <Box className='bd1 fx-row ai-ct '>
                <Image src={isDetail ? Back : Search} h='23px' w='23px' className='click' onClick={isDetail ? () => onBack() : () => null}/>
                <Box 
                    h="64px" 
                    className='w100 fx-row ai-ct' 
                    borderRadius="10px"
                    bgColor="rgba(255,255,255, 0.6)"
                    // bg='linear-gradient(#D8D7A7, #95B9C900, #99CCE2)' 
                   
                >
                    <Image src={Search} h='20px' w='20px'/>
                    <input 
                        value={keyword} 
                        onChange={onChange} 
                        className=' agent_search_input'
                        style={{
                            width: 'calc(100% - 120px)'
                        }}/>
                </Box>
            </Box>  */}

       
               
                <Box 
                    overflowY="scroll" 
                    className=' fx-col ai-ct h100 '  
                    mt="10px"    
                    backdropFilter="blur(10px)"  
                    bgColor='#C5C7BE'
                    borderRadius="10px"
           
                    >
                        <Box className='w100 ' >
                            {
                                !isDetail ?
                                <Box className='w100' px="7px">
                                    {
                                        !!agentList.length && agentList.map((item:any) => (
                                            <Box mt="8px"  key={item._id}  onClick={() => onItem(item)}>
                                                <AgentItem item={item}/>
                                            </Box>
                                        ))
                                    }
                                </Box> : 
                                <FEPlayerDetails game={game} currentFEAgent={currentFEAgent} onClearFEAgent={() => setCurrentFEAgent(null)}/>

                            }
                        </Box>
                </Box> 
         
        </Box>
    )
}


interface iAgentItem {
   item:any
}
export const AgentItem:FC<iAgentItem> = ({
    item
}) => {
    const isLowBattery = false
    return (
        <Box           
            className=' fx-row ai-ct jc-sb w100 click'  
            pos='relative'
            px="13px"
            py="10px"
            borderRadius="10px" 
            bg={isLowBattery ? 'linear-gradient(to right, #E7E5DE 0%,#E1E3DF 45%, #C3827D 100%)' : 'rgba(255, 255, 255, 0.5)'}
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
                                <Box w={`${item.energy}%`} h='100%' borderRadius='10px' bg={ isLowBattery ? 'linear-gradient(to right, #F8ED7E, #E77C46)' : 'linear-gradient(to right, #C4F77E, #46B6E7)'}/>
                            </Box>
                        </Box>
                    </Box>

                </Box>
            </Box>    
            {
                isLowBattery && <Image src={LowBattery} w='24px' h='24px' pos='absolute' top='10px' right='12px'/>
            }
        </Box>
    )
}
