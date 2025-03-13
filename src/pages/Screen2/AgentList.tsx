


import React, { FC, useState, useEffect } from 'react'
import { Text, Link, Box, Image } from '@chakra-ui/react'
import { Transform, X, XHover, PopupDropdown, ButtonBgMd, ButtonBgMdHover } from '@/images'
import { GeneralButton, ClickButtonWrapper } from '@/components'

export const AgentList = () => {
    const [visible, setVisible] = useState<boolean>(false)

    
    
    return(
        <Box>
            <ClickButtonWrapper onClick={() => setVisible(!visible)} disable={false} clickableDisabled={true}>
                <Box 
                    bgImage={ButtonBgMd}
                    bgSize="cover"
                    bgPosition='center'
                    bgRepeat="no-repeat"    
                    className="click fx-row ai-ct jc-sb"
                    // _hover={{
                    //     bgImage: ButtonBgMdHover,
                    //     color: '#293033'
                    // }}
                    // transition="background-image 0.5s ease, color 0.5s ease"
                    h='65px'
                    w="331px"
                    px="36px"
                >
                    <Text className="fw700 fz24 gray">AGENT LIST</Text>
                    <Image src={Transform} w="37px" h="26px"/>
                </Box>
            </ClickButtonWrapper>

            

            {
                visible && 
                <Box 
                    bgImage={PopupDropdown}
                    bgSize="cover"
                    bgPosition='center'
                    bgRepeat="no-repeat"    
                    h='397px'
                    w="331px"
                >
                    <Box
                        px="30px"
                        overflowY='scroll'
                        h="calc(100% - 22px)"
                        pt="44px"
                        className='w100 fx-col jc-ct'
                    >

                        {
                            [1,2,3,4,5,6,7,8,9,10,11,12,13].map(item => (
                                <ListItem item={item} key={item}/>
                            ))
                        }
                    </Box>
                </Box>           
            }
        </Box>    
    )
}



const ListItem = ({ item }:any) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
      <Box 
        className={`fx-row ai-ct jc-sb click  ${isHovered ? 'box_clip' : ''}`}
        h="44px"
        color="#E0E0E0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        px="20px"
        _hover={{
          bgColor: '#838B8D',
          color: '#293033'
        }}
      >
        <Text className="fz20">{item}</Text>
        {
            item < 6 && 
            <Image src={isHovered ? XHover : X} w="24px" h="20px" />
        }
      </Box>
    );
  };
