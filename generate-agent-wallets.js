// Script to batch generate agent wallets
// Usage: node generate-agent-wallets.js [batchSize]

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Default batch size
const batchSize = process.argv[2] ? parseInt(process.argv[2]) : 2;

async function generateWallets() {
  console.log(`Starting to generate ETH wallets for all agents, batch size: ${batchSize}`);
  
  // First, check the current status
  console.log('Fetching current agent wallet status...');
  const { stdout: statsOutput } = await execPromise('npx convex run wallet:getAgentWalletStats');
  console.log(statsOutput);
  
  let offset = 0;
  let remaining = 1; // Initialize to 1 to enter the loop
  let totalProcessed = 0;
  let iteration = 0;
  
  // Continue processing until there are no remaining agents
  while (remaining > 0) {
    iteration++;
    console.log(`\nProcessing batch #${iteration}, starting from ${offset + 1}`);
    
    try {
      // Execute Convex function
      const cmd = `npx convex run wallet:batchGenerateAgentWallets -- '{"limit": ${batchSize}, "offset": ${offset}}'`;
      console.log(`Executing command: ${cmd}`);
      
      const { stdout } = await execPromise(cmd);
      console.log('Command output:', stdout);
      
      // Parse output to get results
      const resultMatch = stdout.match(/\{[\s\S]*\}/);
      if (resultMatch) {
        const resultJson = resultMatch[0];
        console.log('Extracted JSON:', resultJson);
        
        try {
          const result = JSON.parse(resultJson);
          
          // Update status
          remaining = result.remaining || 0;
          offset = result.nextOffset || (offset + batchSize);
          totalProcessed += result.totalUpdated || 0;
          
          console.log(`Batch #${iteration} completed, successfully generated ${result.totalUpdated || 0} wallets`);
          console.log(`Remaining: ${remaining}, next batch starting position: ${offset}`);
        } catch (parseError) {
          console.error('JSON parsing error:', parseError);
          console.error('Attempted to parse JSON string:', resultJson);
          break;
        }
      } else {
        console.error('Unable to parse command output result');
        console.error('Full output:', stdout);
        break;
      }
    } catch (error) {
      console.error('Error during execution:', error);
      if (error.stdout) console.error('Standard output:', error.stdout);
      if (error.stderr) console.error('Error output:', error.stderr);
      break;
    }
    
    // Add delay to avoid potential rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\nAll processing completed, a total of ${totalProcessed} wallets generated`);
  
  // Check final status
  console.log('Fetching final agent wallet status...');
  const { stdout: finalStatsOutput } = await execPromise('npx convex run wallet:getAgentWalletStats');
  console.log(finalStatsOutput);
}

// Execute main function
generateWallets().catch(error => {
  console.error('Script execution error:', error);
  process.exit(1);
}); 