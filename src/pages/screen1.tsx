

import React, { FC } from 'react'
import { Text, Box, Image } from '@chakra-ui/react'
import { Screen1Bg, WorldFun, Screen1SubTitle} from '@/images'
import { GeneralButton, PageLoading, BorderButton } from '@/components'
import { isMobile } from '@/utils/tool'

export const Screen1:FC<{ onMoveTo: (id: number) => void, isActive: boolean }> = ({ onMoveTo, isActive}) => {


  return(
    <Box 
      className=' h-screen' 
      bgImage={Screen1Bg}
      bgSize="cover"
      bgPosition='center'
      bgRepeat="no-repeat"     
      display={isActive ? 'block' : 'none'}
    >
    

      <Box className='center w100' pt="150px">
        <Box 
          className='fx-col ai-ct' 
          w={['314px','440px','502px','628px','628px']}
          // borderWidth="2px"
          // borderStyle='solid'
          // borderColor={['red','green','yellow','blue','pink',]}
        >
          <Image src={WorldFun}  w={['314px','440px','502px','628px','628px']} h={['100.5px','140.7px','160.8px','201px','201px']}/>
          <Image src={Screen1SubTitle} w={['250px','350px','400px','500px','500px']} h={['13px','18.2px','20.8px','26px','26px']} mt="26px"/>
        </Box>
      </Box>

      {
        // !isMobile() && 
        // <Box pos='absolute' bottom="46px" left="50%" transform="translateX(-50%)">
          
        //   <BorderButton
        //     w={369}
        //     h={58}
        //     onClick={() => onMoveTo(1)}
        //     title="Launch 1,000-Agent AI Town"
        //   />          
          
        // </Box>
      }

     
    </Box>
  )
}
