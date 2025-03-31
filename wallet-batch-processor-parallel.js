import fs from 'fs';
import { ConvexHttpClient } from 'convex/browser';
import path from 'path';

// 配置参数 - 可以根据需要调整
const config = {
  // Convex端点URL
  convexUrl: 'https://optimistic-cat-67.convex.cloud',
  
  // 文件路径
  addressFilePath: './address.txt',
  progressFilePath: './progress.json',
  
  // 并行处理设置
  concurrentLimit: 10,    // 同时处理的地址数量
  batchSize: 50,          // 每批处理的地址数量
  delayBetweenBatches: 2000, // 批次之间的延迟（毫秒）
  
  // 单个请求设置
  delayBetweenCalls: 100,  // 登录和签到之间的延迟（毫秒）
  
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

// 加载进度
function loadProgress() {
  try {
    if (fs.existsSync(config.progressFilePath)) {
      const data = JSON.parse(fs.readFileSync(config.progressFilePath, 'utf8'));
      console.log(`从索引 ${data.lastProcessedIndex} 继续处理（上次保存于 ${data.timestamp}）`);
      return data.lastProcessedIndex;
    }
  } catch (err) {
    console.error('加载进度时出错，将从头开始:', err);
  }
  return -1; // 从头开始
}

// 保存进度
function saveProgress(lastProcessedIndex) {
  try {
    fs.writeFileSync(
      config.progressFilePath,
      JSON.stringify({
        lastProcessedIndex,
        timestamp: new Date().toISOString()
      })
    );
    console.log(`进度已保存：已完成到索引 ${lastProcessedIndex}`);
  } catch (err) {
    console.error('保存进度时出错:', err);
  }
}

// 处理单个地址
async function processAddress(address) {
  try {
    // 调用walletLogin
    const loginOperation = async () => {
      return await client.mutation('wallet:walletLogin', { walletAddress: address });
    };
    
    const loginResult = await retry(loginOperation, config.maxRetries, config.retryDelay);
    
    // 添加延迟
    await sleep(config.delayBetweenCalls);
    
    // 调用dailyCheckIn
    const checkInOperation = async () => {
      return await client.mutation('wallet:dailyCheckIn', { walletAddress: address });
    };
    
    const checkInResult = await retry(checkInOperation, config.maxRetries, config.retryDelay);
    
    return {
      address,
      success: true,
      loginResult,
      checkInResult
    };
  } catch (error) {
    return {
      address,
      success: false,
      error: error.message || String(error)
    };
  }
}

// 分割数组为指定大小的批次
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// 并行处理多个地址（限制并发数）
async function processAddressesInParallel(addresses, startIndex) {
  const results = [];
  const promises = [];
  const totalAddresses = addresses.length;

  console.log(`开始处理 ${addresses.length} 个地址，最大并发数: ${config.concurrentLimit}`);
  
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const globalIndex = startIndex + i;
    
    // 创建处理函数
    const processPromise = (async () => {
      console.log(`[${globalIndex + 1}/${totalAddresses}] 处理地址: ${address}`);
      const result = await processAddress(address);
      
      if (result.success) {
        console.log(`  [${globalIndex + 1}/${totalAddresses}] ${address} - 成功`);
        if (result.checkInResult.currentPoints !== null) {
          console.log(`    当前积分: ${result.checkInResult.currentPoints}`);
        }
      } else {
        console.error(`  [${globalIndex + 1}/${totalAddresses}] ${address} - 失败: ${result.error}`);
      }
      
      return result;
    })();
    
    promises.push(processPromise);
    
    // 当达到并发限制或是最后一个地址时，等待所有请求完成
    if (promises.length >= config.concurrentLimit || i === addresses.length - 1) {
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
      promises.length = 0; // 清空promises数组
    }
  }
  
  return results;
}

// 批量处理函数
async function processBatches(allAddresses) {
  let lastProcessedIndex = loadProgress();
  const startIndex = lastProcessedIndex + 1;
  
  if (startIndex >= allAddresses.length) {
    console.log('所有地址已处理完毕');
    return { successful: 0, failed: 0 };
  }
  
  // 获取未处理的地址
  const remainingAddresses = allAddresses.slice(startIndex);
  console.log(`从${startIndex}开始，还有 ${remainingAddresses.length} 个地址待处理`);
  
  // 将地址分批
  const batches = chunkArray(remainingAddresses, config.batchSize);
  console.log(`将分 ${batches.length} 批处理，每批 ${config.batchSize} 个地址`);
  
  let successful = 0;
  let failed = 0;
  
  // 逐批处理
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const currentBatch = batches[batchIndex];
    const batchStartIndex = startIndex + batchIndex * config.batchSize;
    
    console.log(`\n开始处理第 ${batchIndex + 1}/${batches.length} 批，共 ${currentBatch.length} 个地址`);
    
    // 并行处理当前批次
    const results = await processAddressesInParallel(currentBatch, batchStartIndex);
    
    // 统计结果
    for (const result of results) {
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }
    
    // 保存进度
    lastProcessedIndex = batchStartIndex + currentBatch.length - 1;
    saveProgress(lastProcessedIndex);
    
    // 批次间延迟（最后一批不需要）
    if (batchIndex < batches.length - 1) {
      console.log(`批次 ${batchIndex + 1} 完成，等待 ${config.delayBetweenBatches}ms 后处理下一批...`);
      await sleep(config.delayBetweenBatches);
    }
  }
  
  return { successful, failed };
}

// 主处理函数
async function processAllAddresses() {
  // 读取所有地址
  const allAddresses = await readAddresses();
  
  if (allAddresses.length === 0) {
    console.error('没有找到有效地址，请检查文件路径:', config.addressFilePath);
    process.exit(1);
  }
  
  console.log(`找到 ${allAddresses.length} 个地址`);
  
  // 批量处理
  const { successful, failed } = await processBatches(allAddresses);
  
  console.log(`\n所有批次处理完成. 成功: ${successful}, 失败: ${failed}`);
  
  // 重命名进度文件以标记完成
  try {
    const completedFilePath = `${config.progressFilePath}.completed.${Date.now()}`;
    fs.renameSync(config.progressFilePath, completedFilePath);
    console.log(`进度文件已重命名为 ${path.basename(completedFilePath)}`);
  } catch (err) {
    console.error('重命名进度文件时出错:', err);
  }
}

// 运行脚本
console.log('开始并行批量处理钱包登录和每日签到...');
processAllAddresses().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
}); 