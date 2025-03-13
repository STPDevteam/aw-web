
import type { FC } from "react"
import React from "react"
import { Box, Image, Text, Modal, ModalOverlay, ModalContent, ModalBody } from "@chakra-ui/react"
import { GeneralButton }  from '@/components'
import { Close, PopupLg } from '@/images'

interface iBasePopup {
    visible: boolean
    onClose: () => void
    title: string
    content: React.ReactNode
    closeOnOverlay?: boolean
    onOK?: () => void
    okText?: string
}

export const BasePopup: FC<iBasePopup> = ({ 
    visible, 
    onClose, 
    title, 
    content,
    closeOnOverlay = true,
    onOK,
    okText
}) => {

    
    const onHandle = () => {
        if(onOK) {
            onClose()
            onOK()
        }else {
            onClose()
        }
    }

    return (
        <Modal isOpen={visible} onClose={onClose} isCentered closeOnOverlayClick={closeOnOverlay}>
            <ModalOverlay />
            <ModalContent  w="621px" h="625px"  maxWidth="none" bgColor="transparent">
                <ModalBody 
                    p="0"
                    className="fx-col ai-ct "  
                    bgImage={PopupLg}
                    bgSize="cover"
                    bgPosition='center'
                    bgRepeat="no-repeat"   

                >
                    <Box className="fx-row ai-ct jc-sb w100">
                        <Box w="42px" h="42px"/>
                        <Text className="gray fz24 fw700" mt="18px">{title}</Text>  
                        <Image src={Close} w="42px" h="42px" className="click" onClick={onClose}/>          
                    </Box>
                    { content }      
                    {okText && <GeneralButton size="lg" title={okText} onClick={onHandle} style={{ marginTop:'58px' }}/>}
                </ModalBody>                
            </ModalContent>            
        </Modal>
    )
}
