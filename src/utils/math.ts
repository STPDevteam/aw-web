

export function accAdd(num1: number, num2: number) {
    let r1
    let r2
    try {
      r1 = num1.toString().split('.')[1].length
    } catch (e) {
      r1 = 0
    }
    try {
      r2 = num2.toString().split('.')[1].length
    } catch (e) {
      r2 = 0
    }
    const m = 10 ** Math.max(r1, r2)
    return Math.round(num1 * m + num2 * m) / m
  }
  

  export function accSub(num1: number, num2: number) {
    let r1
    let r2
    try {
      r1 = num1.toString().split('.')[1].length
    } catch (e) {
      r1 = 0
    }
    try {
      r2 = num2.toString().split('.')[1].length
    } catch (e) {
      r2 = 0
    }
    const m = 10 ** Math.max(r1, r2)
    const n = r1 >= r2 ? r1 : r2
    return Number((Math.round(num1 * m - num2 * m) / m).toFixed(n) )
  }
  

  export function accMul(num1: number | string, num2: number | string) {
    let m = 0
    const s1 = num1.toString()
    const s2 = num2.toString()
    try {
      m += s1.split('.')[1].length
    } catch (e: any) {
    
    }
    try {
      m += s2.split('.')[1].length
    } catch (e: any) {
      
    }
    return (Number(s1.replace('.', '')) * Number(s2.replace('.', ''))) / 10 ** m
  }
  

  export function accDiv(num1: number, num2: number) {
    let t1
    let t2
    try {
      t1 = num1.toString().split('.')[1].length
    } catch (e) {
      t1 = 0
    }
    try {
      t2 = num2.toString().split('.')[1].length
    } catch (e) {
      t2 = 0
    }
    const r1 = Number(num1.toString().replace('.', ''))
    const r2 = Number(num2.toString().replace('.', ''))
    return (r1 / r2) * 10 ** (t2 - t1)
  }

export const keepDecimals = (num: number | string | undefined | null) => {
  if (num !== undefined && num !== null) {
    const str = num.toString();
    if (str.includes('.')) {
      const [integerPart, decimalPart] = str.split('.');
      const precision = 2 // parseFloat(str) < 1 ? 4 : 3;
      const truncatedDecimal = decimalPart.length > precision ? decimalPart.substring(0, precision) : decimalPart;
      return `${integerPart}.${truncatedDecimal}`;
    }
    return Number(str);
  }
  return 0;
}
  



