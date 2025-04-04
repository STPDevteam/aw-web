import React, { useEffect, createContext, useContext, useState, useMemo, Suspense } from 'react'
import { Screen1 } from './screen1'
import { Screen3 } from './screen3'
import { Screen2 } from './Screen2'
import { Text, Box, Fade } from '@chakra-ui/react'
import { isMobile } from '@/utils/tool'
import { api } from '../../convex/_generated/api.js'
import { useQuery } from 'convex/react'
import {
  Nav11,
  Nav12,
  Nav13,
  Nav21,
  Nav22,
  Nav23,
  Nav31,
  Nav32,
  Nav33,

  NavM11,
  NavM12,
  NavM21,
  NavM22,
  NavM31,
  NavM32,

} from '@/images'
import { Font16 } from '@/components'

const ScreenIndexContext = createContext<number>(0);


export const useScreenIndex = () => useContext(ScreenIndexContext);

const btns = [
  { 
    name: 'Home', 
    id: 'home', 
    class1: 'nav_right_top',
    class2: 'nav_right_top_content',
    defaultBg: Nav11,
    hoverBg: Nav12,
    selectedBg: Nav13,

    mobileDefaultBg: NavM11,
    mobileSelectedBg: NavM12,

    style: {
      borderRadius: '24px 24px 0px 0px',
      border: '1px solid #838B8D',   
    },
    mobileStyle: {
      borderRadius: '14px 0px 0px 14px',
      // border: '1px solid #838B8D',
    }
  },
  { 
    name: 'AI Town', 
    id: 'ai-town',
    class1: '',
    class2: '',
    defaultBg: Nav21,
    hoverBg: Nav22,
    selectedBg: Nav23,
    mobileDefaultBg: NavM21,
    mobileSelectedBg: NavM22,
    style: {
      border: '1px solid #E0E0E0',   
    },
    mobileStyle: {
      borderRadius: '0px',
    }
    
  },
  { 
    name: 'Launchpad', 
    id: 'more-worlds',
    class1: 'nav_right_bottom',
    class2: 'nav_right_bottom_content',
    defaultBg: Nav31,
    hoverBg: Nav32,
    selectedBg: Nav33,
    mobileDefaultBg: NavM31,
    mobileSelectedBg: NavM32,
    style: {
      borderRadius: '0px 0px 24px 24px',
      border: '1px solid #E0E0E0',
    },
    mobileStyle: {
      borderRadius: '0px 14px 14px 0px',
    }
  },
]


export const Pages = () => {  
  const [isScreen2Alive, setScreen2Alive] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // const feAgentsInfo = useQuery(api.frontendAgent.getAllAgents)
  const feAgentsInfo:any[] = []

  useEffect(() => {
    if(currentIndex === 1) {
      setScreen2Alive(true)
    }
  },[currentIndex])

  return (    
    <Box className='h100' pos='relative' bgColor="#1E1E1E">
      {
        isMobile() ? 
        <Box pos='absolute' bottom="20px" left={0} className='center w100'  zIndex={2}>
          <Box w="345px" className='fx-row ai-ct' zIndex={9}>
            {
              btns.map((item, idx) => (
                <Box 
                  key={item.name}
                  onClick={() => setCurrentIndex(idx)}
                  className='center click fm2'
                  h="50px"
                  w="115px"
                  color={idx !== currentIndex ? '#E0E0E0' : '#293033'}
                  bgImage={idx !== currentIndex ? item.mobileSelectedBg : item.mobileDefaultBg}
                  bgSize="cover"
                  bgPosition='center'
                  bgRepeat="no-repeat"  
                >
                  <Font16 t={item.name}/>
                </Box>
              ))
              }
          </Box>
        </Box>:
        <Box pos='absolute' left="1px" top={0} className='h100 fx ai-ct' w="125px"  zIndex={2}>
          <Box className='fx-row ai-ct' h="240px">
            <Box h="240px" className=''>
              {
                  btns.map((item, idx) => (
                    <Box 
                      key={item.name}
                      onClick={() => setCurrentIndex(idx)}
                      title={item.name}
                      bgImage={idx === currentIndex ? item.selectedBg : item.defaultBg}
                      bgSize="cover"
                      bgPosition='center'
                      bgRepeat="no-repeat"  

                      className='center click fm2'
                      h="80px"
                      w="115px"                      
                      color={idx === currentIndex ? '#E0E0E0' : '#293033'}
                      mb="1px"
                      _hover={{
                        color: '#E0E0E0',
                        bgImage: item.hoverBg
                      }}
                    >
                      <Font16 t={item.name}/>
                    </Box>
                  ))
              }
            </Box>         
            {/* <Box className='fx-col jc-sb' h="40px" ml="10px">
              {
                [1,2,3].map(dot => (
                  <Box key={dot}
                    w="8px"
                    h="8px"
                    borderRadius="50%"
                    border="1px solid #E0E0E0"
                    bgColor={currentIndex === dot - 1 ? '#E0E0E0' : 'transparent'}
                  />
                ))
              }
            </Box> */}
          </Box>
        </Box>
      }
      
      <Screen1 
        isActive={currentIndex === 0} 
        onMoveTo={idx => setCurrentIndex(idx)}
      />
      {isScreen2Alive && <Screen2 feAgentsInfo={feAgentsInfo} currentIndex={currentIndex}/>}
      <Screen3 isActive={currentIndex === 2} /> 
    </Box>
  )
}
