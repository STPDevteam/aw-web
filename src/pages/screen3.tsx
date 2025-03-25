import React, { useEffect, useState } from 'react'
import { Box, Flex, Text, useBreakpointValue, Grid, AspectRatio } from '@chakra-ui/react'
import { 
  Screen3Bg1, 
  Screen3Bg2, 
  Screen3Bg3, 
  Screen3Bg4, 
} from '@/images'
import { isMobile } from '@/utils/tool'


export const Screen3:React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const [activeIdx, setActiveIdx] = useState<number>(-1)
  const slides = [Screen3Bg1, Screen3Bg2, Screen3Bg3, Screen3Bg4];
  const titles = [
    { t1: 'Emergent Gaming', t2: '10,000+ NPCs with unique goals with emergent story telling' },
    { t1: 'Decentralized Science', t2: '50,000-agent cities simulated to model pandemics or policy impacts' },
    { t1: 'Extraterrestrial Colonization', t2: 'Simulated growth of first generation of Mars immigrants' },
    { t1: 'On-chain Economies', t2: 'Massive agent-based economies (traders, DAOs, AMMs)' },
  ]

  const debounceTime = 1000

  const columns = useBreakpointValue({ base: 2, sm: 2, md: 2, lg: 4, xl: 4 });

  const [width, setWidth] = useState<number>(window.innerWidth);
  const [maxWidth, setMaxWidth] = useState<string>('430px');

  

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWidth(window.innerWidth);
      }, debounceTime);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [debounceTime]);


  useEffect(() => {
    if(columns as number> 2) {
      setMaxWidth(`calc(${width} / ${columns})px`)
    }else {
      setMaxWidth(`calc(${width - 48} / ${columns})px`)
    }
  },[columns, width])

  const titleHeight = window.innerHeight * 0.2388
  return (  
    <Box 
      className="h-screen fx-row w100" 
      bg="linear-gradient(180deg, #101010 0%, #293033 100%)"
      display={isActive ? 'flex' : 'none'}
    >
      { columns as number > 2 && <Box w="160px" className=''/>}
      <Box className='fx-col ai-ct w100 h100 '>
        <Box
          // height={['105px','142px','165px','175px','175px','215px']}
          h={['105px','142px','165px',titleHeight* 0.7,titleHeight * 0.8,titleHeight]}
          className='w100 fx-col ai-ct jc-ct '
        >
          <Text className='gray fm3' fontSize={['24px','24px','24px','28px','32px', '36px']}>Launchpad</Text>
          <Text className=' fm3' color="#838B8D" fontSize={['14px','14px','14px','14px','14px', '16px']}>World.Fun Beta Coming Soon</Text>
        </Box>
        <Box className='center w100 ' 
          h={[`calc(100% - 210px)`,`calc(100% - 284px)`,`calc(100% - 330px)`,
            `calc(100% - ${titleHeight*0.7* 2}px)`,`calc(100% - ${titleHeight*0.8* 2}px)`,`calc(100% - ${titleHeight * 2}px)`]}
        >
          <Grid
            bg="linear-gradient(180deg, #101010 0%, #293033 100%)"
            className=''
            templateColumns={["repeat(2, 1fr)", "repeat(2, 1fr)", "repeat(4, 1fr)", "repeat(4, 1fr)", "repeat(4, 1fr)"]}
            w={columns as number > 2  ? 'calc(100% - 160px)' : '100%'}
            gap={['10px','10px','10px','10px','0px']}
            // borderWidth="2px"
            // borderStyle='solid'
            // borderColor={['red','green','yellow','blue','pink',]}
            px={['10px','10px','10px','0px','0px',]}
            overflowX="hidden"
            maxW="1720px"
          >
            {slides.map((bg, idx) => {
              const widthValue =
              activeIdx === -1
                ? maxWidth
                : activeIdx === idx
                ? `${width - 160}px`
                : "0px"

              return (
                <Box
                  key={bg}
                  className="click "
                  onMouseOver={() => isMobile() ? null : setActiveIdx(idx)}
                  onMouseLeave={() => isMobile() ? null : setActiveIdx(-1)}
                  w={widthValue}
                  // w={[300 * 0.71667, 420 * 0.71667,420 * 0.71667,480 * 0.71667,500 * 0.71667, 600 * 0.71667]}
                  h={['300px','420px','420px','480px','480px', '600px']}
                  pos='relative'
                  borderRadius='0 0 16px 16px'
                  overflow="hidden"
                  transition="width 0.5s ease, transform 0.5s ease" 
                  transform={activeIdx === idx ? "scale(1.1)" : "scale(1)"}

                  style={{
                    // backgroundSize: 'contain',
                    backgroundSize: 'cover',
                    // aspectRatio: "430/600",
                    backgroundImage: `url(${bg})`,
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                >
                  <Box 
                    pos='absolute'
                    bottom={0}
                    left={0}
                    className='w100 fx-col jc-ct '          
                    px={activeIdx === idx ? ['12px','12px','30px','60px','80px','102px'] : ['8px','8px','12px','16px','20px','26px']} 
                    borderRadius='0 0 16px 16px'
                    bgColor='rgba(34, 52, 74, 0.40)'
                    backdropFilter='blur(25px)'
                    w={widthValue}
                    h={['115px','114px','140px','140px','160px', '206px']}
                    transition="width 0.5s ease"
                    
                  >
                    <Text className='fm1 gray'  fontSize={['14px','18px','18px','20px','20px', '24px']}>{titles[idx].t1}</Text>
                    <Text className='fm2 gray' fontSize={['12px','12px','12px','12px','13px','14px']}>{titles[idx].t2}</Text>
                  </Box>
                </Box>
              );
            })}      
          </Grid>     
        </Box>
      </Box>
    </Box>
  )
}





