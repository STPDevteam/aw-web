import type { FC } from "react";
import React, { useEffect, useState } from "react";
import { Box, Text } from "@chakra-ui/react";

interface iPageLoading {
    onCompleted: (p: number) => void
}

export const PageLoading: FC<iPageLoading> = ({
    onCompleted
}) => {
  const [loadingProgress, setLoadingProgress] = useState(0)

  useEffect(() => {
    let start = 0
    const duration = 15000
    const interval = 100;
    const step = interval / duration

    const timer = setInterval(() => {
      start += step
      setLoadingProgress(start)
      if (start >= 1) {
        clearInterval(timer)
        setLoadingProgress(1)
      }
    }, interval)

    return () => clearInterval(timer);
  }, [])

  useEffect(() => {
    onCompleted(loadingProgress)
  },[loadingProgress])

  return (
    <Box>
        {
            loadingProgress === 1 ? null :
            <Box px="32px" className="center w100">
                <Box maxW="1500px" w="100%">
                    <Box h="10px" borderRadius="12px" bgColor="rgba(217, 217, 217, 0.15)">
                    <Box
                        w={`${loadingProgress * 100}%`}
                        h="10px"
                        bgColor="#838B8D"
                        borderRadius="12px"
                        transition="width 0.1s linear" 
                    />
                    </Box>
                
                    <Box className="fx-row ai-ct jc-sb" mt="8px">
                    <Text className="fz20 gray">Loading...</Text>
                    <Text className="fz20 gray">{`${Math.round(loadingProgress * 100)} %`}</Text>
                    </Box>
                </Box>
            </Box>
        }
    </Box>
  )
}
