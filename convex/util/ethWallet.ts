import { Wallet } from "ethers";

// Simple symmetric encryption function
export function encryptPrivateKey(privateKey: string, encryptionKey: string): string {
  // Simple encryption using XOR operation
  let result = '';
  for (let i = 0; i < privateKey.length; i++) {
    const keyChar = encryptionKey[i % encryptionKey.length];
    const char = String.fromCharCode(privateKey.charCodeAt(i) ^ keyChar.charCodeAt(0));
    result += char;
  }
  // In the Convex environment, Buffer may not exist, use btoa instead
  return typeof Buffer !== 'undefined' 
    ? Buffer.from(result).toString('base64') 
    : btoa(result);
}

// Simple symmetric decryption function
export function decryptPrivateKey(encryptedPrivateKey: string, encryptionKey: string): string {
  // In the Convex environment, Buffer may not exist, use atob instead
  const encrypted = typeof Buffer !== 'undefined'
    ? Buffer.from(encryptedPrivateKey, 'base64').toString()
    : atob(encryptedPrivateKey);
    
  let result = '';
  for (let i = 0; i < encrypted.length; i++) {
    const keyChar = encryptionKey[i % encryptionKey.length];
    const char = String.fromCharCode(encrypted.charCodeAt(i) ^ keyChar.charCodeAt(0));
    result += char;
  }
  return result;
}

// Generate a new Ethereum wallet
export function generateEthWallet(): { privateKey: string; publicKey: string; address: string } {
  // Create a random wallet
  const wallet = Wallet.createRandom();
  
  return {
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey,
    address: wallet.address
  };
}

// Generate a wallet and encrypt its private key
export function generateEncryptedEthWallet(encryptionKey: string): { 
  encryptedPrivateKey: string; 
  publicKey: string; 
  address: string 
} {
  const wallet = generateEthWallet();
  const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, encryptionKey);
  
  return {
    encryptedPrivateKey,
    publicKey: wallet.publicKey,
    address: wallet.address
  };
} 