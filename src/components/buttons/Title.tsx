





import React from "react";
import { Box, Text } from "@chakra-ui/react";
import { ButtonBg, ButtonBgHover, ButtonBgLg, ButtonBgLgHover, ButtonBgMd, ButtonBgMdHover} from '@/images'  

interface iTitle {
  name: string;
  size: 'sm' | 'md' | 'lg'
}

const bgs = {
  sm: { bg: ButtonBg, hover: ButtonBgHover, w: '225px', },
  md: { bg: ButtonBgMd, hover: ButtonBgMdHover, w: '331px', },
  lg: { bg: ButtonBgLg, hover: ButtonBgLgHover, w: '447px', },
}
export const Title: React.FC<iTitle> = ({
    name,
    size
}) => {  
  return (
    <Box 
        bgImage={bgs[size].bg}
        bgSize="cover"
        bgPosition='center'
        bgRepeat="no-repeat"    
        className="center"
        // _hover={{
        //     bgImage: ButtonBgMdHover,
        //     color: '#293033'
        // }}
        // transition="background-image 0.5s ease, color 0.5s ease"
        h='65px'
        w="331px"
    >
        <Text className="fw700 fz24 gray">{name}</Text>
    </Box>
  );
};
