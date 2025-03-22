import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { RootState } from '../store'


interface iAgentState {
  selectedAgentInfo: any
  openConnectWallet: boolean
  alertInfo: {
    open: boolean
    title: string
    content: string
    closeModal?:() => void
  }
  openCreate: boolean
  activeFEAgentId: string
}

const initialState: iAgentState = {
  selectedAgentInfo: null,
  openConnectWallet: false,
  alertInfo: {
    open: false,
    title: '',
    content: '',
    closeModal: () => null
  },
  openCreate: false,
  activeFEAgentId: -1
}

const marketSlice = createSlice({
  name: 'agentReducer',
  initialState,
  reducers: {   
    selectedAgentInfoAction: (state, action: PayloadAction<iAgentState['selectedAgentInfo']>) => {
      state.selectedAgentInfo = action.payload
    },
    openConnectWalletAction: (state, action: PayloadAction<iAgentState['openConnectWallet']>) => {
      state.openConnectWallet = action.payload
    },
    alertInfoAction: (state, action: PayloadAction<iAgentState['alertInfo']>) => {
      state.alertInfo = action.payload
    },
    openCreateAction: (state, action: PayloadAction<iAgentState['openCreate']>) => {
      state.openCreate = action.payload
    },
    activeFEAgentIdAction: (state, action: PayloadAction<iAgentState['activeFEAgentId']>) => {
      state.activeFEAgentId = action.payload
    },
  }
})

export const { 
  selectedAgentInfoAction, 
  openConnectWalletAction,
  alertInfoAction,
  openCreateAction,
  activeFEAgentIdAction
} = marketSlice.actions


export const selectedAgentInfo = (state: RootState) => state.agentReducer.selectedAgentInfo
export const selectOpenConnectWallet = (state: RootState) => state.agentReducer.openConnectWallet
export const selectAlertInfo = (state: RootState) => state.agentReducer.alertInfo
export const selectOpenCreate = (state: RootState) => state.agentReducer.openCreate
export const selectActiveFEAgentId = (state: RootState) => state.agentReducer.activeFEAgentId

export const agentReducer = marketSlice.reducer


