function cleanDocxTextWord(wordsArray) {
  // Clean each item in the array
  wordsArray.forEach((item) => {
    if (item.content) {
      const cleanedContent = cleanWord(item.content);
      item.content = cleanedContent;
    }
    delete item.modified; // Remove the 'modified' property if it exists
    // delete item.color; // Remove the 'color' property if it exists
  });

  // Filter out items that have only special characters in 'content'
  return wordsArray.filter((item) => {
    const hasValidContent = /[a-zA-Z0-9]/.test(item.content);
    return hasValidContent;
  });
}

/**
 * Creates an array of rolling windows from the input data, where each window
 * contains unique content and their corresponding IDs.
 *
 * @param {Array<{content: string, id: number}>} data - An array of data items, where each item
 * has a 'content' (string) and an 'id' (number) property.
 * @param {number} [windowSize=12] - The size of each rolling window.
 * @returns {Array<{contents: string[], ids: number[]}>} An array of rolling windows. Each window is an object
 * with 'contents' (an array of unique content strings) and
 * 'ids' (an array of the corresponding unique IDs).
 */
function createRollingWindows(data, windowSize = 12) {
  const rollingWindows = [];

  for (let i = 0; i <= data.length - windowSize; i++) {
    const windowData = data.slice(i, i + windowSize);

    const uniqueContents = new Set();
    const uniqueIds = [];

    windowData.forEach((item) => {
      if (!uniqueContents.has(item.content)) {
        uniqueContents.add(item.content);
        uniqueIds.push(item.id);
      }
    });

    rollingWindows.push({
      ids: uniqueIds,
      contents: Array.from(uniqueContents),
    });
  }

  return rollingWindows;
}

/**
 * Cleans and normalizes text for comparison
 * @param {string} text - Raw text to clean
 * @returns {string} Cleaned and normalized text
 */
function cleanWord(text) {
  return (
    text
      // Normalize Unicode characters
      .normalize("NFD")
      // Remove diacritics and non-alphabetic characters
      .replace(/[\u0300-\u036f]|[^a-zA-Z0-9 ]/g, "")
      // Replace multiple spaces with a single space
      .replace(/\s+/g, " ")
      // Remove leading/trailing whitespace
      .trim()
      // Convert to lowercase for case-insensitive comparison
      .toLowerCase()
  );
}

export { cleanDocxTextWord, createRollingWindows, cleanWord };
