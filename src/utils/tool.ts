

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