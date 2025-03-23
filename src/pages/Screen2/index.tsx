


import React, { FC, useEffect, useState } from 'react'
import {  Box, Text } from '@chakra-ui/react'
import { Screen2Bg, MapContainer, MapMobile } from '@/images'
import { Nav } from './Nav' 
import { Game } from './Game'
import { Notification, PageLoading } from '@/components'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { alertInfoAction, selectAlertInfo } from '@/redux/reducer'

export const Screen2:FC<{ isActive: boolean, currentIndex: number,feAgentsInfo:any[] }> = ({ isActive, currentIndex, feAgentsInfo }) => {  
  const [feAgentId, setFeAgentId] = useState<number>(-1)
  const { open, title, content, closeModal } = useAppSelector(selectAlertInfo)
  const dispatch = useAppDispatch()

  useEffect(() => {
    const intervalId = setInterval(() => {
      const feSelectedAgentId = localStorage.getItem('agentId')
      getFeDesc(feSelectedAgentId || null)
    }, 1000)
    return () => {
      clearInterval(intervalId)
      localStorage.removeItem('agentId')
    }
  }, []) 

  const getFeDesc = (id: string | null) => {
    
    const newId = id ? Number(id.split(':')[1]) : -1;
    setFeAgentId(prev => (prev === newId ? prev : newId));

    
  }
    
  return(
    <Box 
      className='h-screen w100' 
      bgImage={[null,null,Screen2Bg,Screen2Bg,Screen2Bg]}
      bgSize="cover"
      bgPosition='center'
      bgRepeat="no-repeat"     
      py="40px"
      display={isActive ? 'block' : 'none'}
      bg={['linear-gradient(180deg, #4B494B 0%, #1E2227 100%)', 'linear-gradient(180deg, #4B494B 0%, #1E2227 100%)', null,null,null]}
    >
      <Box 
        className='w100 fx-row ai-ct '  
        display={['none','none','none','flex','flex']}
       
      > 
        <Box minW="115px" w="160px" className=''  h="100px"/>
        <Box className='w100 fx-col ai-ct ' >
          <Nav/>
          <Box className='w100 center' mt="20px">
            <Game feAgentId={feAgentId} currentIndex={currentIndex} feAgentsInfo={feAgentsInfo}/>
          </Box>
        </Box>
      </Box>

      
      {/* mobile side */}
      <Box 
        w="100%" 
        display={['flex','flex','flex','none','none']} 
        className='fx-col ai-ct'
        
        >
        <Box className='w100 center' h="105px">
          <Text className='gray fz24'>AI Town</Text>
        </Box>
        <Box
          bgImage={MapContainer}
          bgSize="cover"
          bgPosition='center'
          bgRepeat="no-repeat"   
          w="347px"
          h="519px"
          className='fx-col ai-ct'
          pt="16px"
        > 
        <Box
          bgImage={MapMobile}
          w="316px"
          h="433.5px"
          bgSize="cover"
          bgPosition='center'
          bgRepeat="no-repeat"   
          className='center'
        >
          <Box className='center' w="266px" h="100px" borderRadius="14px" bgColor='rgba(34, 58, 54, 0.20)' backdropFilter="blur(15px)">
            <Text className='gray fz14'>Please access AI Town on PC</Text>
          </Box>
        </Box>
        </Box>
      </Box>

      <Notification
        visible={open}
        onClose={() => {
          dispatch(alertInfoAction({
            open: false,
            title: '',
            content: ''
          }))
          closeModal && closeModal()
        }}
        title={title}
        content={content}
    />
    </Box>
  )
}

