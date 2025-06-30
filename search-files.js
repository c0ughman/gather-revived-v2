import fs from 'fs';
import path from 'path';

function searchInFile(filePath, patterns) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return patterns.some(pattern => content.includes(pattern));
  } catch (error) {
    return false;
  }
}

function findFiles(dir, extensions, patterns) {
  const results = [];
  
  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext) && searchInFile(fullPath, patterns)) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  traverse(dir);
  return results;
}

// Search for files containing the specified patterns
const patterns = ['user_usage', 'usage_stats', 'plan_id'];
const extensions = ['.ts', '.tsx'];
const srcDir = 'src';

const matchingFiles = findFiles(srcDir, extensions, patterns);

console.log('Files containing user_usage, usage_stats, or plan_id:');
matchingFiles.slice(0, 10).forEach(file => console.log(file));

if (matchingFiles.length === 0) {
  console.log('No files found containing the specified patterns.');
}