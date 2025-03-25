


import React, { FC, useEffect, useState } from 'react'
import {  Box, Text } from '@chakra-ui/react'
import { Screen2Bg, MapContainer, MapMobile } from '@/images'
import { Nav } from './Nav' 
import { Game } from './Game'
import { Notification, ProgressiveBackground } from '@/components'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { alertInfoAction, selectAlertInfo } from '@/redux/reducer'

export const Screen2:FC<{ feAgentsInfo:any, currentIndex: number }> = ({  feAgentsInfo, currentIndex }) => {  
  const [delayRender, setDelayRender] = useState(false)
  const { open, title, content, closeModal } = useAppSelector(selectAlertInfo)
  const dispatch = useAppDispatch()


  useEffect(() => {    
    const timer = setTimeout(() => {
      setDelayRender(true);
    }, 3000)
  
    return () => {
      clearTimeout(timer)
    }
  }, [])


  const _h = 0.375531 * window.innerWidth 
  const worldHeight = _h > 706 ? "706px" : delayRender ? `auto` : `${_h}px`
  // const worldHeight = _h > 706 ? "706px" : `${_h}px`
  return(
    <ProgressiveBackground
          blurAmount={20}              
          transitionDuration="1s"     

          display={currentIndex === 1 ? 'block' : 'none'}
          className='h-screen w100' 
          src={Screen2Bg}
          bgSize="cover"
          bgPosition='center'
          bgRepeat="no-repeat"     
          py="40px"
          bg={['linear-gradient(180deg, #4B494B 0%, #1E2227 100%)', 'linear-gradient(180deg, #4B494B 0%, #1E2227 100%)', null,null,null]}          
        >
     
        <Box 
          className='w100 fx-row ai-ct h100'  
          display={['none','none','none','flex','flex']}
        > 
          <Box minW="115px" w="160px" h="100px"/>
          

          <Box className=' w100 center fx-col' >
            <Nav/>
            <Box h={worldHeight}>
              <Game worldHeight={worldHeight} feAgentsInfo={feAgentsInfo}/>
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
  
    </ProgressiveBackground>
        
 
  )
}

