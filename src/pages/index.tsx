import React, { useEffect, createContext, useContext, useState } from 'react'
import { Screen1 } from './screen1'
import { Screen3 } from './screen3'
import { Screen4 } from './screen4'
import { Screen2 } from './Screen2'

import ReactFullpage from '@fullpage/react-fullpage'

import { Text, Box } from '@chakra-ui/react'
import { isMobile } from '@/utils/tool'


const ScreenIndexContext = createContext<number>(0);


export const useScreenIndex = () => useContext(ScreenIndexContext);

const btns = [
  { 
    name: 'Home', 
    id: 'home', 
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
    style: {
      border: '1px solid #E0E0E0',   
    },
    mobileStyle: {
      borderRadius: '0px',
    }
    
  },
  { 
    name: 'More Worlds', 
    id: 'more-worlds',
    style: {
      borderRadius: '0px 0px 24px 24px',
      border: '1px solid #E0E0E0',
    },
    mobileStyle: {
      borderRadius: '0px 14px 14px 0px',
    }
  },
]


const Container:React.FC<{
  children: React.ReactNode,
  title: React.ReactNode,

}> = ({
  title,
  children
}) => {
  return(
    <Box w="calc(100% - 125px)" className='h-screen'>
      { children }
    </Box>
  )
}

export const Pages = () => {  
  const [currentIndex, setCurrentIndex] = useState(0)
  
  return (  
    <Box className='h100' pos='relative'>
        {
          isMobile() ? 
          <Box pos='absolute' bottom="20px" left={0} className='center w100'>
            <Box w="345px" className='fx-row ai-ct'>
              {
                btns.map((item, idx) => (
                  <Box 
                    key={item.name}
                    onClick={() => setCurrentIndex(idx)}
                    title={item.name}
                    style={item.mobileStyle}
                    className='center click'
                    h="49px"
                    w="115px"
                    bgColor={idx === currentIndex ? '#293033' : "#838B8D"}
                    backdropFilter="blur(10px)"
                    color={idx === currentIndex ? '#E0E0E0' : '#293033'}
                    _hover={{
                      bgColor: '#1F1F23',
                      color: '#E0E0E0'
                    }}
                  >
                    <Text className='fz16' fontWeight={350}>{item.name}</Text>
                  </Box>
                ))
                }
            </Box>
          </Box>:
          <Box pos='absolute' left="1px" top={0} className='h100 fx ai-ct' w="125px" >
            <Box className='fx-row ai-ct' h="240px">
              <Box h="240px" className=''>
                {
                    btns.map((item, idx) => (
                      <Box 
                        key={item.name}
                        onClick={() => setCurrentIndex(idx)}
                        title={item.name}
                        style={item.style}
                        className='center click'
                        h="80px"
                        w="115px"
                        bgColor={idx === currentIndex ? '#293033' : "#838B8D"}
                        backdropFilter="blur(10px)"
                        color={idx === currentIndex ? '#E0E0E0' : '#293033'}
                        
                        _hover={{
                          bgColor: '#1F1F23',
                          color: '#E0E0E0'
                        }}
                      >
                        <Text className='fz16' fontWeight={350}>{item.name}</Text>
                      </Box>
                    ))
                }
              </Box>         
              <Box className='fx-col jc-sb' h="40px" ml="10px">
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
              </Box>
            </Box>
          </Box>
        }

        

        { currentIndex === 0 && <Screen1 onMoveTo={idx => setCurrentIndex(idx)}/>}
        { currentIndex === 1 &&  <Screen2/>  }
        { currentIndex === 2 && <Screen3/> }
    </Box>
  )
}
