


import React, { FC, useState, useMemo } from 'react'
import { Text, Link, Box, Image } from '@chakra-ui/react'
import { Transform, X, XHover, PopupDropdown, ButtonBgMd, ButtonBgMdHover } from '@/images'
import { GeneralButton, ClickButtonWrapper } from '@/components'
import { api } from '../../../convex/_generated/api.js'
import {  Id } from '../../../convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { selectedAgentInfo, selectedAgentInfoAction } from '@/redux/reducer/agentReducer'

export const AgentList:FC<{  worldId: Id<'worlds'> }> = ({ worldId }) => {
    const [visible, setVisible] = useState<boolean>(false)

    const dispatch = useAppDispatch()
  

    const agents = useQuery(api.world.paginatedPlayerDescriptions, { 
            worldId,
            paginationOpts: {
                numItems: 100,
                cursor: null,
            }
    })
    
    const renderedAgents = useMemo(() => {
        return (
          !!agents?.page &&
          agents.page.length > 0 &&
          agents.page.map((item, idx) => (
            <ListItem item={item} key={item._id} idx={idx} focusAgent={() => dispatch(selectedAgentInfoAction(item))}/>
          ))
        )
      }, [agents])

    return(
        <Box>
            <ClickButtonWrapper onClick={() => setVisible(!visible)} disable={false} clickableDisabled={true}>
                <Box 
                    bgImage={ButtonBgMd}
                    bgSize="cover"
                    bgPosition='center'
                    bgRepeat="no-repeat"    
                    className="click fx-row ai-ct jc-sb"
                    // _hover={{
                    //     bgImage: ButtonBgMdHover,
                    //     color: '#293033'
                    // }}
                    // transition="background-image 0.5s ease, color 0.5s ease"
                    h='65px'
                    w="331px"
                    px="36px"
                >
                    <Text className="fw700 fz24 gray">AGENT LIST</Text>
                    <Image src={Transform} w="37px" h="26px"/>
                </Box>
            </ClickButtonWrapper>

            {
                visible && 
                <Box 
                    bgImage={PopupDropdown}
                    bgSize="cover"
                    bgPosition='center'
                    bgRepeat="no-repeat"    
                    h='397px'
                    w="331px"
                    pt="22px"
                >
                    <Box
                        overflowY='scroll'
                        h="calc(100% - 22px)"
                        px="30px"
                        className='w100 '
                    >
                        { renderedAgents }
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
      <Box 
        className={`fx-row ai-ct jc-sb click  ${isHovered ? 'box_clip' : ''}`}
        color="#E0E0E0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={isSpecialAgent ? () => focusAgent() : () => null }
        h="44px"
        px="20px"
        _hover={{
          bgColor: '#838B8D',
          color: '#293033'
        }}
      >
        <Text className="fz20">{item.name}</Text>
        {
            isSpecialAgent && 
            <Image src={isHovered ? XHover : X} w="24px" h="20px" />
        }
      </Box>
    )
}

