


import React, { useState } from "react";
import { Box, Spinner, Text, Image, Button } from "@chakra-ui/react";
import { BtnSvg, BtnHoverSvg } from '@/images'

interface iSvgButton {
  loading?: boolean;
  disable?: boolean;
  onClick: () => any;
  name: string;
  w: number[];
  h: number[];
  hover?: string
}

// 


export const SvgButton:React.FC<iSvgButton> = ({  
    loading = false,
    disable = false,
    onClick,
    name,
    w,
    h,
    hover
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
        // <Box
        //     borderWidth="2px"
        //     borderStyle='solid'
        //     borderColor={['red','green','yellow','blue','pink',]}
        // >

        <Button
            position='relative'
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            // w={_w}
            w={w}
            h={h}
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
            <Image src={isHovered ? BtnHoverSvg : BtnSvg}/>  
            {loading ? 
                <Spinner size="md" color="white" h='24px' w='24px' pos="absolute"/> : 
                <Text   
                    fontSize={['14px','14px','14px','14px','16px']} 
                    pos="absolute" 
                    fontWeight={350}
                >{isHovered ? (hover ? hover : name) : name}</Text>
            }
        </Button>   
        // </Box>
    );
  };
  
