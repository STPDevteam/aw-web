
import React, { useState } from 'react';
import {  Box, Button, Spinner, Text, Tooltip} from '@chakra-ui/react'
import { Tooltip1, Tooltip2 } from '@/images'

interface iBorderButton {
  loading?: boolean;
  disable?: boolean;
  onClick: () => any;
  title: string | React.ReactNode;
  w: number;
  h: number;
  isFixedWidth?: boolean
  titleDiv?: React.ReactNode
  hover?: string
  disableStillHasHoverEvent?: boolean
  tooltip?: {
    label: string
    size: 'md' | 'sm'
  }
}

export const BorderButton:React.FC<iBorderButton> = ({  
  loading = false,
  disable = false,
  onClick,
  title,
  w,
  h,
  isFixedWidth,
  titleDiv,
  hover,
  tooltip,
  disableStillHasHoverEvent = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleClick = () => {
      if(loading || disable) {
        return false
      }else {
        onClick()
      }
  }
  // const _w = w.map(item => item / 0.822222)
  // console.log(_w)
  return (      
    <Box className='btn1_border w100 h100' h={`${h}px`}>
      <Box  className='btn1_border_content w100 h100' p="2px">
        <Box className='btn2_border w100 h100'>
          <Box className='btn2_border_content w100 h100'> 
           <Tooltip 
            label={ tooltip ? 
              <Box
                className='center'
                mt="-8px"
                pt="4px"
                bgImage={tooltip?.size === 'md' ? Tooltip2 : Tooltip1}
                bgSize="cover"
                bgPosition="center"
                bgRepeat="no-repeat"
                h="45px"
                w={tooltip?.size === 'md' ? '262px' : '182px'}
              >
                <Text  className='fm2 ' color="#293033" fontWeight={350} fontSize={['14px','14px','14px','14px','14px','16px']}>{tooltip?.label}</Text>
              </Box> : null
            } 
            hasArrow={false}
            // isOpen
            bgColor='none'
            >
                <Button
                  onMouseEnter={ () => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  className='click box_clip fm2'
                  w={isFixedWidth ? [w-4] : [(w - 4)*0.5,(w - 4)*0.5,(w - 4)*0.5,(w - 4)*0.7,(w - 4)*0.8,w - 4,]}
                  h={`${h-4}px`}
                  onClick={handleClick}
                  bg={disableStillHasHoverEvent ? '#7E8081' : 'none'}
                  color="#E0E0E0" 
                  _hover={{ 
                      color: disable ? '#E0E0E0' : '#293033',
                      bgColor: disableStillHasHoverEvent ? '#7E8081' : '#838B8D',
                  }}
                  _active={{ bg: "transparent" }}
                  _focus={{ boxShadow: "none" }}
                  disabled={disable}
                  _disabled={{ bg: "#7E8081" }}
                  // 
                >   
                  {loading ? 
                    <Spinner size="md" color="white" h='24px' w='24px' pos="absolute"/> : 
                    <>
                      {titleDiv || <Text className='fm2' w="100%" color="#E0E0E0" fontWeight={350} fontSize={['14px','14px','14px','14px','14px','16px']}>{isHovered ? (hover ? hover : title) : title}</Text>}
                    </>
                    
                  }
              
                </Button>   
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}