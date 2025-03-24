
import type { FC } from "react"
import React, { useEffect } from "react"
import { Box, Image, Text, Modal, ModalOverlay, ModalContent, ModalBody } from "@chakra-ui/react"
import { GeneralButton, BorderButton }  from '@/components'
import { Close, PopupLg } from '@/images'

interface iBasePopup {
    visible: boolean
    onClose: () => void
    title: string
    content: React.ReactNode
    closeOnOverlay?: boolean
    onOK?: () => void
    okText?: string
    okLoading?: boolean
    modalSize?: {
        w: string
        h: string
    }
}

export const BasePopup: FC<iBasePopup> = ({ 
    visible, 
    onClose, 
    title, 
    content,
    closeOnOverlay = true,
    onOK,
    okText,
    okLoading = false,
    modalSize
}) => {

     useEffect(() => {
        const fullpageInstance = (window as any).fullpage_api    
        if (visible && fullpageInstance) {
            fullpageInstance.setAllowScrolling(false)
            fullpageInstance.setKeyboardScrolling(false)
        } else if (fullpageInstance) {
            fullpageInstance.setAllowScrolling(true)
            fullpageInstance.setKeyboardScrolling(true)
        }
    }, [visible])
    
    const onHandle = () => {
        if(onOK) {
            // onClose()
            onOK()
        }else {
            onClose()
        }
    }

    return (
        <Modal isOpen={visible} onClose={onClose} isCentered closeOnOverlayClick={closeOnOverlay}>
            <ModalOverlay />
            <ModalContent  w={modalSize?.w || '594px'} h={modalSize?.h || '604px'}  maxWidth="none" bgColor="transparent">
                <ModalBody 
                    p="0"
                    className="fx-col ai-ct "  
                    bgImage={PopupLg}
                    bgSize="cover"
                    bgPosition='center'
                    bgRepeat="no-repeat"   

                >
                    <Box className="fx-row ai-ct jc-sb w100">
                        <Box w="35px" h="35px"/>
                        <Text className="gray" fontWeight={600} fontSize={['16px','16px','16px','16px','18px','20px']} mt="20px">{title}</Text>  
                        <Image src={Close} w="35px" h="35px" className="click" onClick={onClose}/>          
                    </Box>
                    { content }      
                    {okText && 
                    <Box pos='absolute' bottom="20px" w={450} className=" ">
                        <BorderButton
                            isFixedWidth={true}
                            loading={okLoading} 
                            w={450}
                            h={50}
                            onClick={onHandle}
                            title={okText}
                        />   
                    </Box>
                    }
                </ModalBody>                
            </ModalContent>            
        </Modal>
    )
}
