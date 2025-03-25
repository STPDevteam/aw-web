

import React, { FC } from 'react'
import { Text, Box, Image } from '@chakra-ui/react'
import { Screen1Bg, WorldFun, Screen1SubTitle} from '@/images'
import { ProgressiveBackground } from '@/components'


export const Screen1:FC<{ onMoveTo: (id: number) => void, isActive: boolean }> = ({ onMoveTo, isActive}) => {


  return(
    <ProgressiveBackground
      src={Screen1Bg}
      blurAmount={20}              
      transitionDuration="1s"     
      w="100%"                      
      h="100vh"
      display={isActive ? 'block' : 'none'}
    >
    

        <Box className='center w100' pt="150px">
          <Box 
            className='fx-col ai-ct' 
            w={['314px','440px','502px','628px','628px']}
          >
            <Image src={WorldFun}  w={['314px','440px','502px','628px','628px']} h={['100.5px','140.7px','160.8px','201px','201px']}/>
            <Image src={Screen1SubTitle} w={['250px','350px','400px','500px','500px']} h={['13px','18.2px','20.8px','26px','26px']} mt="26px"/>
          </Box>
        </Box>
     
    </ProgressiveBackground>
    
  )
}
