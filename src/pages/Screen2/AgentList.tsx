


import React, { FC, useState, useMemo } from 'react'
import { Text, Button, Box, Image } from '@chakra-ui/react'
import { Transform, Search } from '@/images'
import { BorderButton, ClickButtonWrapper, Font16 } from '@/components'
import { api } from '../../../convex/_generated/api.js'
import {  Id } from '../../../convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { selectedAgentInfoAction } from '@/redux/reducer/agentReducer'

export const AgentList:FC<{  worldId: Id<'worlds'> }> = ({ worldId }) => {
    const [visible, setVisible] = useState<boolean>(false)

    const dispatch = useAppDispatch()


    const agentsServer = useQuery(api.world.paginatedPlayerDescriptions, { 
        worldId,
        paginationOpts: {
            numItems: 50,
            cursor: null,
        }
    })
    
    const renderedAgents = useMemo(() => {
        if(!!agentsServer?.page && agentsServer.page.length > 0) {
            return (
                // list.map((item, idx) => (
                agentsServer.page.map((item, idx) => (
                <ListItem item={item} key={item._id} idx={idx} focusAgent={() => {
                    dispatch(selectedAgentInfoAction(item))
                }}/>
              ))
            )
        }
      }, [agentsServer])

    return(
        <Box>

            <BorderButton
                w={256}
                h={46}
                onClick={() => setVisible(!visible)}
                title=""
                isFixedWidth={true}
                titleDiv={
                    <Box className='fx-row ai-ct jc-sb w100  ' h="46px"  >
                        <Font16 t="Agent List"/>
                        <Image src={Transform} w="25px" h="18px"/>
                    </Box>
                }
            />   
           
            {
                visible &&   //
                    <Box className='card1_border  h100 '  h='397px' >
                        <Box  className='card1_border_content w100 h100' p="10px">
                            <Box className='card2_border w100 h100' >
                                <Box className='card2_border_content w100 h100' overflowY="scroll"  h="calc(100% - 22px)" onWheel={(e) => e.stopPropagation()} > 
                                    
                                        { renderedAgents }
                                  
                                </Box>
                            </Box>
                        </Box>
                    </Box>                  
            }
        </Box>    
    )
}


const ListItem:FC<{ item:any, idx: number, focusAgent:() => void }>= ({ item,idx, focusAgent}) => {
    const [isHovered, setIsHovered] = useState(false)
    const isSpecialAgent = idx < 5 
    return (
        <Box className='w100 center'>
            <Box 
                className='fx-row ai-ct jc-sb click box_clip'
                color="#E0E0E0"
                px="20px"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={focusAgent }
                // onClick={isSpecialAgent ? () => focusAgent() : () => null }
                h="44px"
                w="214px"
                _hover={{
                bgColor: '#838B8D',
                color: '#293033'
                }}
            >
                    <Text color="#E0E0E0" className='fm3' fontWeight={350} fontSize={['14px','14px','14px','14px','14px','16px']}>{item.name}</Text>

                {
                    // isSpecialAgent && 
                    // <Image src={isHovered ? XHover : X} w="18px" h="15px" />
                }
            </Box>
        </Box>
    )
}

