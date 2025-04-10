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

function createRollingWindows(data, windowSize = 12) {
  let result = [];

  for (let i = 0; i <= data.length - windowSize; i++) {
    let windowSlice = data.slice(i, i + windowSize);

    // Track unique contents and their corresponding IDs
    let uniqueContents = new Set();
    let uniqueIds = [];

    windowSlice.forEach((item) => {
      // Only add the ID if we haven't seen this content before
      if (!uniqueContents.has(item.content)) {
        uniqueContents.add(item.content);
        uniqueIds.push(item.id);
      }
    });

    result.push({
      ids: uniqueIds,
      contents: Array.from(uniqueContents),
    });
  }

  return result;
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
