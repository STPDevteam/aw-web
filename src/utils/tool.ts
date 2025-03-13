

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