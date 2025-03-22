import type { FC } from "react";
import React, { useEffect, useState } from "react";
import { Box, Text, Image } from "@chakra-ui/react";
import { Screen1Bg,
    Screen2Bg,
    Screen3Bg1,
    Screen3Bg2,
    Screen3Bg3,
    Screen3Bg4,
    Message,
    ButtonBg,
    ButtonBgHover,
    ButtonBgLg,
    ButtonBgLgHover,
    ButtonBgMd,
    ButtonSsm,
    ButtonBgMdHover,
    Close,
    Popup,
    PopupLg,
    ArrowBottom,
    Transform,
    XHover,
    PopupDropdown,
    GameLeftBorder,
    GameRightBorder,
    WorldFun,
    Screen1SubTitle,
    MapContainer,
    MapMobile,
    Logo,
    ButtonBgMd2,
    ButtonBgMd2Hover
} from '@/images'
import { motion } from "framer-motion"
const MotionImage = motion(Image)
interface iPageLoading {
    onCompleted: (p: number) => void
}

export const PageLoading: FC<iPageLoading> = ({
    onCompleted
}) => {
    const resourceUrls = [
        Screen1Bg,
        Screen2Bg,
        Screen3Bg1,
        Screen3Bg2,
        Screen3Bg3,
        Screen3Bg4,
        Message,
        ButtonBg,
        ButtonBgHover,
        ButtonBgLg,
        ButtonBgLgHover,
        ButtonBgMd,
        ButtonSsm,
        ButtonBgMdHover,
        Close,
        Popup,
        PopupLg,
        ArrowBottom,
        Transform,
        XHover,
        PopupDropdown,
        GameLeftBorder,
        GameRightBorder,
        WorldFun,
        Screen1SubTitle,
        MapContainer,
        MapMobile,
        Logo,
        ButtonBgMd2,
        ButtonBgMd2Hover
    ]

    const [loadingProgress, setLoadingProgress] = useState(0)

    useEffect(() => {
        preloadResources(resourceUrls, (progress) => {
            setLoadingProgress(progress)
        })
        .then(() => {
            
        })
        .catch((error) => {
            console.error("loading resouce error:", error)
           
        })

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


    function preloadImage(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const img = new window.Image()
            img.src = url
            img.onload = () => resolve()
            img.onerror = () => reject(new Error("loading iamges error: " + url))
        })
    }

    async function preloadResources(urls: string[], onProgress: (progress: number) => void): Promise<void> {
        const total = urls.length
        let loaded = 0
        const promises = urls.map(url =>
            preloadImage(url).then(() => {
                loaded++
                onProgress(loaded / total)
            })
        )
        await Promise.all(promises)
    }


  useEffect(() => {
    onCompleted(loadingProgress)
  },[loadingProgress])

  const maxW = 1000
  return (
    <Box className="w100">
        {
            loadingProgress === 1 ? null :
            <Box px={['20px','20px','30px','40px','80px']} className="center w100">
                <Box maxW={maxW} w="100%">
                    <MotionImage
                        src={Logo}
                        w="37px"
                        h="50px"
                        mb="5px"
                        animate={{
                            x: `${loadingProgress * maxW}px` 
                        }}
                        transition={{ duration: 0.1, ease: "linear" }}
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

