


import React, { useEffect, useState } from 'react'
import { Box, Image, Text, Modal, ModalOverlay, ModalContent, ModalBody } from "@chakra-ui/react"
import { ElectionResultsImg, ModalClose, ModalCloseHover, AweLogo } from '@/images'
import { openLink } from '@/utils/tool'

const EVENT_START_TIME = "2025-05-07T21:00:00+08:00"; //  9pm UTC+8 May 7

export const ElectionResults = () => {  
    const [open, setOpen] = useState(false)
    const [isHover, setHover] = useState(false)
    const [timeLeft, setTimeLeft] = useState('')
    const [countdownOver, setCountdownOver] = useState(false)
    
    useEffect(() => {
        const timer = setTimeout(() => setOpen(true), 5000)
        return () => clearTimeout(timer)
    }, [])

    
    useEffect(() => {
      
        const target = new Date(EVENT_START_TIME).getTime()
    
        const update = () => {
          const diff = target - Date.now()
          if (diff <= 0) {
            setCountdownOver(true)
            setTimeLeft('')
            return
          }
          const hours = Math.floor(diff / 3600000)
          const mins = Math.floor((diff % 3600000) / 60000)
          const secs = Math.floor((diff % 60000) / 1000)
          const pad = (n: number) => n.toString().padStart(2, '0')
          setTimeLeft(`${pad(hours)}:${pad(mins)}:${pad(secs)}`)
        }
    
        update()
        const iv = setInterval(update, 1000)
        return () => clearInterval(iv)
      }, [])

    const onClose = () => {
        setOpen(false)
    }

    const onJoin = () => {
        openLink('https://t.me/STPofficial')
    }

 
    return(
        <Modal isOpen={open} onClose={onClose} isCentered closeOnOverlayClick={false} autoFocus={false} >
            <ModalOverlay />
            <ModalContent  w='524px' h='429px'  maxWidth="none" bgColor="transparent" >
                <ModalBody 
                    p="2px"
                    className="fx-col ai-ct w100 h100"  
                    borderRadius='10px'
                    backdropFilter="blur(10px)"  
                    bgColor='#0A0D1199'
                >
                    <Box pos='relative'>
                        <Image 
                            pos='absolute'
                            top='7px'
                            right='6px'
                            onMouseOver={() => setHover(true)}
                            onMouseLeave={() => setHover(false)}
                            src={isHover ? ModalCloseHover : ModalClose } 
                            w="24px" 
                            h="24px" 
                            className="click" 
                            onClick={onClose}/>          
                        <Image className='click' onClick={onJoin} src={ElectionResultsImg} w='524px' h='280px' borderTopRadius='10px'/>
                    </Box>
                    {!countdownOver && (
                        <Box className='fx-row fm3 w100 center' h='56px' borderBottom='1px solid #8097A233'> 
                            <Text color='white' fontSize='18px' fontWeight={400} className=''  w='175px' >
                                Starting in {timeLeft}
                            </Text>
                            <Box h='30px' w='118px' bgColor='#00000033' borderRadius='50px' className='center click' onClick={onJoin}>
                                <Text color='white' fontSize='16px' fontWeight={400}>Join Now&gt;&gt;</Text>
                            </Box>
                        </Box>
                    )}
                    <Image src={AweLogo} w='234px' h='44px' mt="23px"/>
                </ModalBody>                
            </ModalContent>            
        </Modal>
    )
}




