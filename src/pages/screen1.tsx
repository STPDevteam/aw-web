

import React, { FC } from 'react'
import { Text, Box, Image } from '@chakra-ui/react'
import { Screen1Bg, WorldFun, Screen1SubTitle} from '@/images'
import { GeneralButton, Notification, BasePopup, CreateInput } from '@/components'

export const Screen1:FC<{ onMoveTo: (id: string) => void }> = ({ onMoveTo }) => {
  return(
    <Box 
      className=' h-screen' 
      bgImage={Screen1Bg}
      bgSize="cover"
      bgPosition='center'
      bgRepeat="no-repeat"     
    >
      <Box className='center w100' pt="28px">
        <Box className='fx-row ai-ct jc-sb' w="554px">
          {
            [
              { name: 'HOME', id: 'landing-page'},
              { name: 'AI TOWN', id: 'world-fun'},
              { name: 'WORLDS', id: 'platform-generated-worlds'},
              { name: 'AGENTS', id: 'emergent-gaming'},
            ].map(item => (
              <GeneralButton 
                onClick={() => onMoveTo(item.id)}
                title={item.name}
                size='ssm'
              />
            ))
          }
        </Box>
      </Box>

      <Box className='center w100' mt="82px">
        <Box className='fx-col ai-ct'  w="628px">
          <Image src={WorldFun} w="628px" h="201px"/>
          <Image src={Screen1SubTitle} w="500px" h="26px" mt="26px"/>
        </Box>
      </Box>

      <Box pos='absolute' bottom="46px" left="50%" transform="translateX(-50%)">
        <GeneralButton  
          onClick={() => onMoveTo('world-fun')}
          title="Launch 1,000-Agent AI Town"
          size='lg'
        />
      </Box>
    </Box>
  )
}
