import React, { useEffect, useState } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { 
  Screen3Bg1, 
  Screen3Bg2, 
  Screen3Bg3, 
  Screen3Bg4, 
} from '@/images'

export const Screen3 = () => {
  const [activeIdx, setActiveIdx] = useState<number>(-1)
  const slides = [Screen3Bg1, Screen3Bg2, Screen3Bg3, Screen3Bg4];
  const titles = [
    { t1: 'Emergent Gaming', t2: '10,000+ NPCs with unique goals with emergent story telling' },
    { t1: 'Decentralized Science', t2: '50,000-agent cities simulated to model pandemics or policy impacts' },
    { t1: 'Extraterrestrial Colonization', t2: 'Simulated growth of first generation of Mars immigrants' },
    { t1: 'On-chain Economies', t2: 'Massive agent-based economies (traders, DAOs, AMMs)' },
  ]

  return (
    <Box className="h-screen fx-col ai-ct">
      <Flex
        width="100%"
        height="215px"
        bg="#101010"
        align="center"
        justify="center"
      >
        <Text className='fz48 gray'>
          Platform-Generated Autonomous Worlds
        </Text>
      </Flex>
      <Box
        height="calc(100vh - 215px)"
        bg="linear-gradient(180deg, #101010 0%, #293033 100%)"
        className='w100 center'
      >
        {slides.map((bg, idx) => {
        
          const widthValue = activeIdx === -1 ? "430px" : activeIdx === idx ? `${430 * slides.length}px` : "0px";
          return (
            <Box
              key={bg}
              className="click"
              onMouseOver={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(-1)}
              w={widthValue}
              h="600px" 
              pos='relative'
              borderRadius='0 0 16px 16px'
              overflow="hidden"
              transition="width 0.5s ease"
              style={{
                backgroundImage: `url(${bg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <Box 
                pos='absolute'
                bottom={0}
                left={0}
                className='w100 fx-col jc-ct'          
                pl="26px" 
                borderRadius='0 0 16px 16px'
                bgColor='rgba(34, 52, 74, 0.40)'
                backdropFilter='blur(25px)'
                w={widthValue}
                h="206px"
                transition="width 0.5s ease"
              >
                <Text className='fz26 gray'>{titles[idx].t1}</Text>
                <Text className='fz16 gray'>{titles[idx].t2}</Text>
              </Box>
            </Box>
          );
        })}      
      </Box>     
    </Box>
  )
}


