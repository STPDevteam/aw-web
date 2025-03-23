import type { FC } from "react";
import React, { useEffect, useState } from "react";
import { Box, Text, Image } from "@chakra-ui/react";
import { 

    MapLoading
} from '@/images'
import { motion,  useMotionValue, useTransform } from "framer-motion"
const MotionImage = motion(Image)
interface iPageLoading {
    onCompleted: (p: number) => void
    maxW: number
}

export const PageLoading: FC<iPageLoading> = ({
    onCompleted,
    maxW
}) => {
 
    const [loadingProgress, setLoadingProgress] = useState(0)

    useEffect(() => {

        let start = 0
        const duration = 10000
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
    <Box className="w100">
        {
            loadingProgress === 1 ? null :
            <Box px={['20px','20px','30px','40px','80px']} className="center w100">
                <Box w={maxW} >
                    <MotionImage
                        src={MapLoading}
                        w="37px"
                        h="50px"
                        mb="5px"
                        animate={{
                            x: `${loadingProgress * maxW}px`,
                            rotateY: '180deg'
                        }}
                        transition={{ duration: 0, ease: "linear", }}
                    />
                    
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

