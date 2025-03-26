
import { BigNumber, ethers } from 'ethers'

export const sleep = (ms: number): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), ms)
    })
}

export const truncateAddress = (address: string) => {        
  if (!address || address.length < 8) {
      return address
  }
  return `${address.substring(0,4)}...${address.substring(address.length - 4,)}`
}

export const openLink = (url: string) => {
  window.open(url,'_blank')
}

export const isMobile = (): boolean => {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
  return mobileRegex.test(userAgent)
}

export const isiOS = (): boolean => {
return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export const formatYYYYMMDDHHMMSS = (timestamp: number): string => {
  const date = new Date(timestamp); 
  const padZero = (num: number): string => (num < 10 ? `0${num}` : num.toString());

  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1); 
  const day = padZero(date.getDate());
  const hours = padZero(date.getHours());
  const minutes = padZero(date.getMinutes());
  const seconds = padZero(date.getSeconds());

  return `${year}/${month}${day} ${hours}:${minutes}:${seconds}`;
};


const executeContractMethod = async (contract: any, method: string, waitForConfirmation: boolean, ...args: any[]) => {
  // const tx = await contract[method](...args);
  // if (waitForConfirmation) {
  //     await tx.wait(); 
  // }
  // return tx.hash;

  try {
      const tx = await contract[method](...args);
      if (waitForConfirmation) {
          await tx.wait(); 
      }
      return { hash: tx.hash, message: '' };
  } catch (error: any) {
      let errorMessage = '';
      if (error.code === 'ACTION_REJECTED') {
          errorMessage = "User rejected the transaction";
      } else {
          errorMessage = `An error occurred: ${error.message || error}`;
      }
      // throw new Error(errorMessage);
      return { hash: '', message: errorMessage }
  }
}

interface iERC20Approve {
  tokenContractAddress: string
  tokenABI: any
  approveAddress: string
  approveAmount: string | BigNumber
  signer: any
}

export const ERC20Approve = async ({ tokenContractAddress, tokenABI, approveAddress, approveAmount, signer }: iERC20Approve) => {

  if ( signer) {    
    const signerAddress = await signer.getAddress();
    
    const tokenContract = new ethers.Contract(tokenContractAddress, tokenABI, signer);

    const balance = await tokenContract.balanceOf(signerAddress);

    if (balance.lt(approveAmount)) {
      return { hash: '', message: 'Insufficient balance' };
    }

    const currentAllowance = await tokenContract.allowance(signerAddress, approveAddress);

    if (currentAllowance.gte(approveAmount)) {
      return { hash: 'no need to approve', message: '' };
    }
    return await executeContractMethod(tokenContract, 'approve', true, approveAddress, approveAmount);
    
  }
};

export const parseUnits = (amount: number | string, p: number):BigNumber => {
  return ethers.utils.parseUnits(Number(amount).toFixed(p), p)
}


