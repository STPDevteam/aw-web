
import type { FC } from "react"
import React, { useEffect } from "react"
import { Box, Image, Text } from "@chakra-ui/react"

interface iPageLoading {
    
}

export const PageLoading: FC<iPageLoading> = ({ 
    
}) => {
    const progress = 0.1
    return (
        <Box px="32px" className="center w100">
            <Box maxW="1500px" w="100%" className="">
                <Box h="10px" borderRadius="12px" bgColor='rgba(217, 217, 217, 0.15)' >
                    <Box w={`${progress * 100 }%`} h="10px" bgColor='#838B8D' borderRadius="12px" />
                </Box>
                <Box className="fx-row ai-ct jc-sb">
                    <Text className="fz20 gray">Loading...</Text>
                    <Text className="fz20 gray">{`${progress * 100 } %`}</Text>
                </Box>
            </Box>
        </Box>
    )
}

