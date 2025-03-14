import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { RootState } from '../store'


interface iAgentState {
  selectedAgentInfo: any
 

}

const initialState: iAgentState = {
  
  selectedAgentInfo: null


}

const marketSlice = createSlice({
  name: 'agentReducer',
  initialState,
  reducers: {
   
    
    selectedAgentInfoAction: (state, action: PayloadAction<iAgentState['selectedAgentInfo']>) => {
      state.selectedAgentInfo = action.payload
    },
    
  }
})

export const { 
  selectedAgentInfoAction, 

 } = marketSlice.actions


export const selectedAgentInfo = (state: RootState) => state.agentReducer.selectedAgentInfo


export const agentReducer = marketSlice.reducer


