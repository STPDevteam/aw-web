

import React, { FC } from 'react'
import { Text, Link, Box, Image } from '@chakra-ui/react'
import { Screen3Bg } from '@/images'


export const Screen3 = () => {
  return(
    <Box 
      className=' h-screen' 
      bgImage={Screen3Bg}
      bgSize="cover"
      bgPosition='center'
      bgRepeat="no-repeat"     
    >
        <h1></h1>
    </Box>
  )
}
