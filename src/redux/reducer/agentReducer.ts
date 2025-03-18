import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { RootState } from '../store'


interface iAgentState {
  selectedAgentInfo: any
  openConnectWallet: boolean
}

const initialState: iAgentState = {
  selectedAgentInfo: null,
  openConnectWallet: false
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
  }
})

export const { 
  selectedAgentInfoAction, 
  openConnectWalletAction
} = marketSlice.actions


export const selectedAgentInfo = (state: RootState) => state.agentReducer.selectedAgentInfo
export const selectOpenConnectWallet = (state: RootState) => state.agentReducer.openConnectWallet

export const agentReducer = marketSlice.reducer


