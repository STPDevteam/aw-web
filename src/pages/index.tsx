import React, { useEffect, createContext, useContext, useState } from 'react'
import { Screen1 } from './screen1'
import { Screen3 } from './screen3'
import { Screen4 } from './screen4'
import { Screen2 } from './Screen2'

import ReactFullpage from '@fullpage/react-fullpage'

import { Text, Link, Box, Image } from '@chakra-ui/react'


const ScreenIndexContext = createContext<number>(0);


export const useScreenIndex = () => useContext(ScreenIndexContext);

export const Pages = () => {  
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // useEffect(() => {
  //   console.log = () => {};
  //   console.info = () => {};
  //   console.warn = () => {};
  //   console.error = () => {};
  // },[])

  // console.log('currentIndex', currentIndex)
  return (  
    <ScreenIndexContext.Provider value={currentIndex}>
      <div className='h100 '>
        <ReactFullpage
          credits={{ enabled: false }} 
          scrollingSpeed={500} 
          controlArrows={false}
          afterLoad={(origin, destination, direction) => setCurrentIndex(destination.index)}
          anchors={['landing-page', 'world-fun', 'platform-generated-worlds', 'emergent-gaming']}
          render={({ fullpageApi }) => {
            return (
              <Box className='h100 '>
                <Box className="section h100 ">
                  <Screen1 onMoveTo={id => fullpageApi.moveTo(id)}/>
                </Box>
                <div className="section h100" >     
                  <Screen2/>          
                </div>
                <div className="section h100">
                  <Screen3/>
                </div>
                
                <div className="section h100">
                  <Screen4/>
                </div>
                
              </Box>
            )
          }}
        />
      </div>
    </ScreenIndexContext.Provider>
  )
}
