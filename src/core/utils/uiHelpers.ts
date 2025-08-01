/**
 * Shared UI helper functions to eliminate code duplication
 */

/**
 * Create radial gradient for agents without avatars
 */
export const createAgentGradient = (color: string): string => {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Create complementary color by shifting hue and make it lighter
  const compR = Math.round(255 - r * 0.3); // Softer complement
  const compG = Math.round(255 - g * 0.3);
  const compB = Math.round(255 - b * 0.3);
  
  // Make complementary color lighter than the main color
  const lightCompR = Math.round(compR + (255 - compR) * 0.8);
  const lightCompG = Math.round(compG + (255 - compG) * 0.8);
  const lightCompB = Math.round(compB + (255 - compB) * 0.8);
  
  return `radial-gradient(circle, rgb(${lightCompR}, ${lightCompG}, ${lightCompB}) 0%, ${color} 40%, rgba(${r}, ${g}, ${b}, 0.4) 50%, rgba(${r}, ${g}, ${b}, 0.1) 60%, rgba(0, 0, 0, 0) 70%)`;
};

/**
 * Get user bubble gradient based on agent color
 */
export const getUserBubbleGradient = (color: string): string => {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Create a subtle gradient using the agent's color
  const lightR = Math.round(r + (255 - r) * 0.2);
  const lightG = Math.round(g + (255 - g) * 0.2);
  const lightB = Math.round(b + (255 - b) * 0.2);
  
  return `linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, rgb(${lightR}, ${lightG}, ${lightB}) 100%)`;
};

/**
 * Format file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}; 

/**
 * Truncates text to a specified length with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * CSS classes for consistent text truncation
 */
export const truncationClasses = {
  singleLine: 'truncate',
  twoLines: 'line-clamp-2',
  threeLines: 'line-clamp-3',
  overflowHidden: 'overflow-hidden text-ellipsis whitespace-nowrap'
}; 