import React from 'react';
import { Box, Flex, Image, Text } from '@chakra-ui/react';
import { Screen4Bg1, Screen4Bg2, Screen4Bg3 } from '@/images';


const ImageOverlayCard = ({ src, overlaySide }: { src: any, overlaySide: 'left' | 'right'}) => {
  return (
    <Box position="relative">
      <Box
        borderRadius={overlaySide === 'left' ? "16px 0 0 16px" : "0 16px 16px 0"}
        w="500px"
        h="200px"
        bgColor="rgba(34, 52, 74, 0.30)"
        backdropFilter="blur(15px)"
        position="absolute"
        top="0"
        {...(overlaySide === 'left' ? { left: 0 } : { right: 0 })}
      />
      <Image src={src} w="1200px" h="200px" borderRadius="16px" />
    </Box>
  );
};

export const Screen4 = () => {
  return (
    <Box height="100vh">
      <Flex
        width="100%"
        height="215px"
        bg="#101010"
        align="center"
        justify="center"
      >
        <Text fontSize="48px" color="gray.300">
          User-Generated Autonomous Agents
        </Text>
      </Flex>

      <Box
        height="calc(100vh - 215px)"
        bg="linear-gradient(180deg, #101010 0%, #293033 100%)"
        className='w100 center'
      >
        <Box maxW="1700px" width="100%">
          <Flex align="center" justify="space-between">
            <ImageOverlayCard src={Screen4Bg1} overlaySide="left" />
            <Box width="500px" />
          </Flex>
          <Flex align="center" justify="space-between">
            <Box width="500px" />
            <ImageOverlayCard src={Screen4Bg2} overlaySide="right" />
          </Flex>
          <Flex align="center" justify="space-between">
            <ImageOverlayCard src={Screen4Bg3} overlaySide="left" />
            <Box width="500px" />
          </Flex>
        </Box>
      </Box>
    </Box>
  );
};
