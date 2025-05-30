import React, { lazy, Suspense } from 'react'
import {  Box, Text } from '@chakra-ui/react'
import { Game } from './Screen2/Game'
import { Notification } from '@/components'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { alertInfoAction, selectAlertInfo } from '@/redux/reducer'
import { ElectionResults } from '@/pages/Screen2/ElectionResults'



export const IframeScreen = () => {  
  const { open, title, content, closeModal } = useAppSelector(selectAlertInfo)
  const dispatch = useAppDispatch()


  return(
        <Box>
            <Game feAgentsInfo={[]}/>  
            <ElectionResults/>
            <Notification
                visible={open}
                onClose={() => {
                    dispatch(alertInfoAction({
                    open: false,
                    title: '',
                    content: ''
                    }))
                    closeModal && closeModal()
                }}
                title={title}
                content={content}
            />  
        </Box> 
  )
}

