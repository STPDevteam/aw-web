


import React from "react";
import { Box, Spinner, Text } from "@chakra-ui/react";
import { ClickButtonWrapper } from './ClickButtonWrapper'
import { ButtonBg, ButtonBgHover, ButtonSsm, ButtonBgLg, ButtonBgLgHover, ButtonBgMd, ButtonBgMdHover} from '@/images'  

interface iGeneralButton {
  loading?: boolean;
  loadingSize?: string;
  disable?: boolean;
  onClick: () => any;
  title: string;
  style?: React.CSSProperties;
  fz?: string
  size: 'ssm' | 'sm' | 'md' | 'lg' 
}

const bgs = {
  ssm: { bg: ButtonBg, hover: ButtonBgHover, w: '127px', h: '39px', fz: '14px', },
  sm: { bg: ButtonBg, hover: ButtonBgHover, w: '225px',h: '69px', fz: '24px', },
  md: { bg: ButtonBgMd, hover: ButtonBgMdHover, w: '331px', h: '69px', fz: '24px',},
  lg: { bg: ButtonBgLg, hover: ButtonBgLgHover, w: '447px', h: '69px', fz: '24px',},
}
export const GeneralButton: React.FC<iGeneralButton> = ({

  loading = false,
  loadingSize = '32px',
  disable = false,
  onClick,
  title,
  style,
  fz = '24px',
  size
}) => {
  const handleClick = () => {
    if(loading || disable) {
      return false
    }else {
      onClick()
    }
  }
  
  return (
    <ClickButtonWrapper onClick={handleClick} disable={disable} clickableDisabled={true}> 
      <Box
        bgImage={bgs[size].bg}
        bgSize="cover"
        bgPosition='center'
        bgRepeat="no-repeat"    
        className="center"
        cursor={(loading || disable) ? 'not-allowed' : 'pointer'}
        color="#E0E0E0"
        _hover={{
          bgImage: bgs[size].hover,
          color: '#293033'
        }}
        transition="background-image 0.5s ease, color 0.5s ease"
        h={bgs[size].h}
        w={bgs[size].w}
        style={{
          ...style,
        }}
      >
        {loading ? 
          <Spinner size="md" color="white" h={ loadingSize } w={ loadingSize } /> : 
          <Text fontSize={bgs[size].fz}>{title}</Text>
        }
      </Box>
    </ClickButtonWrapper>
  );
};
