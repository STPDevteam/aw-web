
import type { FC } from "react"
import React, { useEffect } from "react"
import { Box, Image, Text, Modal, ModalOverlay, ModalContent, ModalBody } from "@chakra-ui/react"
import { Close, Popup } from '@/images'
import ReactFullpage from '@fullpage/react-fullpage';

interface iNotification {
    visible: boolean
    onClose: () => void
    title: string
    content: string
    closeOnOverlay?: boolean
}

export const Notification: FC<iNotification> = ({ 
    visible, 
    onClose, 
    title, 
    content,
    closeOnOverlay = true
}) => {

    useEffect(() => {
        const fullpageInstance = (window as any).fullpage_api;
    
        if (visible && fullpageInstance) {
          fullpageInstance.setAllowScrolling(false);
          fullpageInstance.setKeyboardScrolling(false);
        } else if (fullpageInstance) {
          fullpageInstance.setAllowScrolling(true);
          fullpageInstance.setKeyboardScrolling(true);
        }
      }, [visible]);


    return (
        <Modal isOpen={visible} onClose={onClose} isCentered closeOnOverlayClick={closeOnOverlay}>
            <ModalOverlay />
            <ModalContent  w="594px" h="260px"  maxWidth="none" bgColor="transparent">
                <ModalBody 
                    p="0"
                    className="fx-col ai-ct "  
                    bgImage={Popup}
                    bgSize="cover"
                    bgPosition='center'
                    bgRepeat="no-repeat"   

                >
                    <Box className="fx-row ai-ct jc-sb w100">
                        <Box w="35px" h="35px"/>
                        <Text className="gray fm2" fontWeight={600} fontSize={['16px','16px','16px','16px','18px','20px']} mt="20px">{title}</Text>  
                        <Image src={Close}  w="35px" h="35px" className="click" onClick={onClose}/>          
                    </Box>
                    <Text className="gray fm3" fontWeight={400} fontSize={['16px','16px','16px','16px','18px','20px']} mt="99px">{content}</Text>             
                </ModalBody>                
            </ModalContent>
        </Modal>
    )
}
