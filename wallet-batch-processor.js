import fs from 'fs';
import { ConvexHttpClient } from 'convex/browser';

// 配置参数 - 可以根据需要调整
const config = {
  // Convex端点URL
  convexUrl: 'https://optimistic-cat-67.convex.cloud',
  
  // 文件路径
  addressFilePath: './address.txt',
  
  // 延迟设置（毫秒）
  delayBetweenCalls: 200,     // 登录和签到之间的延迟
  delayBetweenAddresses: 500, // 处理不同地址之间的延迟
  
  // 重试设置
  maxRetries: 3,
  retryDelay: 1000,
};

// 初始化Convex客户端
const client = new ConvexHttpClient(config.convexUrl);

// 延迟函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 重试函数
async function retry(operation, retries, delay) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`尝试 ${attempt + 1} 失败，${delay}ms后重试...`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

// 读取地址
async function readAddresses() {
  try {
    const data = fs.readFileSync(config.addressFilePath, 'utf8');
    return data.split('\n')
      .map(addr => addr.trim())
      .filter(addr => addr && addr.startsWith('0x'));
  } catch (err) {
    console.error('读取地址文件错误:', err);
    return [];
  }
}

// 处理单个地址
async function processAddress(address, index, total) {
  console.log(`[${index + 1}/${total}] 处理地址: ${address}`);
  
  try {
    // 调用walletLogin
    const loginOperation = async () => {
      return await client.mutation('wallet:walletLogin', { walletAddress: address });
    };
    
    const loginResult = await retry(loginOperation, config.maxRetries, config.retryDelay);
    console.log(`  登录结果: ${loginResult.isNewUser ? '新用户创建' : '已有用户更新'}`);
    
    // 添加延迟
    await sleep(config.delayBetweenCalls);
    
    // 调用dailyCheckIn
    const checkInOperation = async () => {
      return await client.mutation('wallet:dailyCheckIn', { walletAddress: address });
    };
    
    const checkInResult = await retry(checkInOperation, config.maxRetries, config.retryDelay);
    console.log(`  签到结果: ${checkInResult.success ? '成功' : '失败'} - ${checkInResult.message}`);
    
    if (checkInResult.currentPoints !== null) {
      console.log(`  当前积分: ${checkInResult.currentPoints}`);
    }
    
    return true;
  } catch (error) {
    console.error(`  处理地址 ${address} 时出错:`, error);
    return false;
  }
}

// 主处理函数
async function processAllAddresses() {
  const addresses = await readAddresses();
  
  if (addresses.length === 0) {
    console.error('没有找到有效地址，请检查文件路径:', config.addressFilePath);
    process.exit(1);
  }
  
  console.log(`找到 ${addresses.length} 个地址待处理`);
  
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const result = await processAddress(address, i, addresses.length);
    
    if (result) {
      successful++;
    } else {
      failed++;
    }
    
    // 添加地址间延迟(最后一个地址不需要)
    if (i < addresses.length - 1) {
      await sleep(config.delayBetweenAddresses);
    }
  }
  
  console.log(`\n处理完成. 成功: ${successful}, 失败: ${failed}`);
}

// 运行脚本
console.log('开始批量处理钱包登录和每日签到...');
processAllAddresses().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
}); 