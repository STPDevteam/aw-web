


import React, { FC } from 'react'
import {  Box,  } from '@chakra-ui/react'
import { Screen2Bg } from '@/images'

import { Nav } from './Nav' 
import Game from '@/components/Game'

export const Screen2 = () => {


  
  return(
    <Box 
      className='h-screen' 
      bgImage={Screen2Bg}
      bgSize="cover"
      bgPosition='center'
      bgRepeat="no-repeat"     
      px="100px"
      py="40px"
    >
        <Nav/>
        <Game/>        
    </Box>
  )
}
