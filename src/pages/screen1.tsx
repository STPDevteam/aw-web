

import React, { FC } from 'react'
import { Text, Link, Box, Image } from '@chakra-ui/react'
import { Screen1Bg } from '@/images'


export const Screen1 = () => {
  return(
    <Box 
      className=' h-screen' 
      bgImage={Screen1Bg}
      bgSize="cover"
      bgPosition='center'
      bgRepeat="no-repeat"     
    >
        <h1>111</h1>
    </Box>
  )
}
