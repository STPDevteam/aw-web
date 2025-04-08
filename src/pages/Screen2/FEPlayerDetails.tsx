
import { Box, Image, Text  } from '@chakra-ui/react'
import { useEffect, useMemo, useState} from 'react';
import { SwitchTab} from "@/components"
import { AgentItem } from './SearchAgents'
import { ServerGame } from '@/hooks/serverGame';
import { formatYYYYMMDDHHMMSS } from '@/utils/tool'

interface iFEPlayerDetails {
    currentFEAgent: any
    onClearFEAgent: () => void
    game: ServerGame
}
export const FEPlayerDetails:React.FC<iFEPlayerDetails> = ({
    currentFEAgent,
    onClearFEAgent,
    game
}) => {
    // console.log('currentFEAgent', currentFEAgent)
    const player = currentFEAgent.playerId && game.world.players.get(currentFEAgent.playerId); 
    
    const playerConversation = player && game.world.playerConversation(player)

    // console.log('player', player)
    
    // console.log('playerConversation', playerConversation)

 
    const [selectedIdx, setSelectedIdx] = useState(0)
    
    
   
    return (
        <Box className='w100 ' >
            {
                currentFEAgent &&
                <Box className=''>
                    <AgentItem item={currentFEAgent}/>

                    <Box className='w100 center ' px="18px" mt="14px">
                        <Text color="#535C5F" fontSize="14px">{currentFEAgent.description}</Text>
                    </Box>

                    <SwitchTab onChange={i => setSelectedIdx(i)}/>
                    <Box px="12px">
                        {
                            selectedIdx === 0 ? <>
                                {
                                    playerConversation && playerConversation.map((item:any) => (
                                    <Box key={item.timestamp} className='fx-col' mt="10px" bgColor="rgba(255,255,255,0.5)">
                                        <Box className='fx-row ai-ct jc-sb fm3'>
                                            <Text color="#000" fontWeight={700} fontSize={['14px','14px','14px','14px','14px','16px']}>{item.role}</Text>
                                            <Text color="#535C5F" fontWeight={400} fontSize={['14px','14px','14px','14px','14px','16px']}>{formatYYYYMMDDHHMMSS(item.timestamp) }</Text>
                                        </Box>
                                        <Text color="#535C5F" fontWeight={400} mt="8px" fontSize={['14px']}>{item.content}</Text>
                                    </Box>
                                    ))
                                }
                            </>:
                            <Box>
                                <Box 
                                    className='center  ' 
                                    py="14px" 
                                    px="20px"
                                    bgColor='rgba(255,255,255,0.5)' 
                                    borderRadius="10px"
                                    mt="14px">
                                        <Box className='fx-row ai-ct jc-sb' flexWrap="wrap">
                                                {
                                                    currentFEAgent.status.map((item:any) => (
                                                        <Text 
                                                            mt="4px"
                                                            w="50%"
                                                            className='fm3'
                                                            key={item.title} 
                                                            color="#000"
                                                            fontSize={['14px']}>
                                                            {item.title}<span>:{item.icon}</span>
                                                        </Text>

                                                    ))
                                                }
                                        </Box>
                                </Box>        
                                <Box mt='10px' mb="20px">
                                    {
                                        currentFEAgent.events.map((item:any,idx: number) => (
                                            <Box 
                                                key={item.action} 
                                                className='fx-row ai-ct jc-sb fm3' 
                                                py="14px" 
                                                px="20px"
                                                whiteSpace="nowrap"
                                                borderTopRadius={idx === 0 ? '10px' : 0}
                                                borderBottomRadius={idx === currentFEAgent.events.length - 1 ? '10px' : 0}

                                                bg={idx % 2 === 1 ? 'linear-gradient(to right, #EBEAE7, #EBECE9)' : 'linear-gradient(to right, #D7D6D4, #EAE9E2)'}
                                                color="#000"
                                                fontSize={['14px']}
                                            >
                                                <Text >{`${item.time}-${item.action}`}</Text>
                                                <Text>{item.details}</Text>    
                                        </Box>

                                        ))
                                    }
                                </Box>                          
                            </Box>
                        }
                    </Box>
                
                </Box>
            }
        </Box>
    )
}
