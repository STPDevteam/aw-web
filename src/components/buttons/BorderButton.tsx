
import React, { } from 'react';
import {  Box, Button, Spinner, Text} from '@chakra-ui/react'
import { Font16 } from '@/components'


interface iBorderButton {
  loading?: boolean;
  disable?: boolean;
  onClick: () => any;
  title: string | React.ReactNode;
  w: number;
  h: number;
}

export const BorderButton:React.FC<iBorderButton> = ({  
  loading = false,
  disable = false,
  onClick,
  title,
  w,
  h
}) => {
  // const [isHovered, setIsHovered] = useState(false);
  
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
    <Box className='btn1_border w100 h100'>
    <Box  className='btn1_border_content w100 h100' p="2px">
      <Box className='btn2_border w100 h100'>
        <Box className='btn2_border_content w100 h100'> 
          <Button
            className='click'
            w={[(w - 4)*0.5,(w - 4)*0.5,(w - 4)*0.5,(w - 4)*0.7,(w - 4)*0.8,w - 4,]}
            h={h-4}
            onClick={handleClick}
            bg="none"
            color="#E0E0E0" 
            _hover={{ 
                color: disable ? '#E0E0E0' : '#293033'
            }}
            _active={{ bg: "transparent" }}
            _focus={{ boxShadow: "none" }}
            disabled={disable}
          >   
            {loading ? 
                <Spinner size="md" color="white" h='24px' w='24px' pos="absolute"/> : 
                <Text w="100%" color="#E0E0E0" fontWeight={350} fontSize={['14px','14px','14px','14px','14px','16px']}>{title}</Text>
            }
          </Button>   
        </Box>
      </Box>
    </Box>
  </Box>
  
  )
}