import React, { useState, } from 'react'
import { Box, Image, Text } from '@chakra-ui/react'
import { 
  Screen4Bg1, 
  Screen4Bg2, 
  Screen4Bg3, 
  Screen4Bg4, 
  Arrow, 
} from '@/images'

export const Screen4 = () => {
  const [activeIdx, setActiveIdx] = useState<number>(0)
  const slides = [Screen4Bg1, Screen4Bg2, Screen4Bg3, Screen4Bg4];
  const titles = [
    { t1: 'Emergent Gaming', t2: '10,000+ NPCs with unique goals with emergent story telling' },
    { t1: 'Decentralized Science', t2: '50,000-agent cities simulated to model pandemics or policy impacts' },
    { t1: 'Extraterrestrial Colonization', t2: 'Simulated growth of first generation of Mars immigrants' },
    { t1: 'On-chain Economies', t2: 'Massive agent-based economies (traders, DAOs, AMMs)' },
  ]
  return (
    <Box className="h-screen " position="relative">
      <div className="fp-slides">
        {slides.map((bg, idx) => {
            
          return(
            <div
              key={idx}
              className="slide"
              style={{
                backgroundImage: `url(${bg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                height: '100vh'
              }}
            />
          )
        })}
      </div>
      <Box 
        className=' w100 fx-col center'
      
        pos='absolute'
        top='50%'
        transform="translateY(-50%)"
        zIndex="9"
        borderRadius='10px'
        bgColor='rgba(16, 16, 16, 0.44)'
        backdropFilter='blur(5px)'
        w="900px"
        h="250px"
      >
        <Text className='fz48 gray' >{titles[activeIdx].t1}</Text>
        <Text className='fz24 gray'>{titles[activeIdx].t2}</Text>
      </Box>
      <Box 
        className=' w100 fx jc-sb ai-ct'
        px="42px"
        pos='absolute'
        top='50%'
        transform="translateY(-50%)"
        zIndex="10"
        >
        <Box style={{ transform: 'rotate(180deg)'}}>
          <Image 
            src={Arrow} 
            w="35px"
            h="108px"
            alt="Previous Slide" 
            cursor="pointer"
            className="custom-arrow-left"
            onClick={() => window.fullpage_api && window.fullpage_api.moveSlideLeft()}
          />
        </Box>
        <Image 
          src={Arrow} 
          alt="Next Slide" 
          w="35px"
          h="108px"
          cursor="pointer"
          className="custom-arrow-right"
          onClick={() => window.fullpage_api && window.fullpage_api.moveSlideRight()}
        />
      </Box>
    </Box>
  )
}
