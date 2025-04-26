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
function createRollingWindows(data, windowSize = 13) {
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

const stopWords = [
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "ain",
  "al",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "aren",
  "aren’t",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "couldn",
  "couldn’t",
  "d",
  "did",
  "didn",
  "didn’t",
  "do",
  "does",
  "doesn",
  "doesn’t",
  "doing",
  "don",
  "don’t",
  "down",
  "during",
  "each",
  "et",
  "few",
  "for",
  "from",
  "further",
  "had",
  "hadn",
  "hadn’t",
  "has",
  "hasn",
  "hasn’t",
  "have",
  "haven",
  "haven’t",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "isn",
  "isn’t",
  "it",
  "it’s",
  "its",
  "itself",
  "just",
  "ll",
  "m",
  "ma",
  "me",
  "mightn",
  "mightn’t",
  "more",
  "most",
  "mustn",
  "mustn’t",
  "my",
  "myself",
  "needn",
  "needn’t",
  "no",
  "nor",
  "not",
  "now",
  "o",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "re",
  "s",
  "same",
  "shan",
  "shan’t",
  "she",
  "she’s",
  "should",
  "should’ve",
  "shouldn",
  "shouldn’t",
  "so",
  "some",
  "such",
  "t",
  "than",
  "that",
  "that’ll",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "ve",
  "very",
  "was",
  "wasn",
  "wasn’t",
  "we",
  "were",
  "weren",
  "weren’t",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "won",
  "won’t",
  "wouldn",
  "wouldn’t",
  "y",
  "you",
  "you’d",
  "you’ll",
  "you’re",
  "you’ve",
  "your",
  "yours",
  "yourself",
  "yourselves",
];

function removeStopWords(arrayOfObjects) {
  console.log(typeof arrayOfObjects);
  return arrayOfObjects.filter((item) => {
    return !stopWords.includes(item.content);
  });
}

/**
 * Generates trigrams from an array of word objects with IDs.
 * @param {Array<{id: number, content: string}>} wordObjects - Array of word objects with ID and content
 * @returns {Object} Object containing the trigrams and a set of unique trigram texts
 */
function generateStructuredTrigrams(wordObjects) {
  // If we have fewer than 3 words, we can't make trigrams
  if (wordObjects.length < 3) {
    return { trigrams: {}, uniqueTrigramTexts: new Set() };
  }

  const trigramDictionary = {};
  const uniqueTrigramTexts = new Set();

  // Generate trigrams by sliding a window of 3 words
  for (let i = 0; i <= wordObjects.length - 3; i++) {
    // Create a concatenated key for the dictionary
    const trigramKey = `${wordObjects[i].content}${wordObjects[i + 1].content}${
      wordObjects[i + 2].content
    }`;

    // Create a human-readable trigram with spaces
    const readableTrigramText = `${wordObjects[i].content} ${
      wordObjects[i + 1].content
    } ${wordObjects[i + 2].content}`;

    // Store the IDs of the words forming this trigram
    const wordIds = [
      wordObjects[i].id,
      wordObjects[i + 1].id,
      wordObjects[i + 2].id,
    ];

    // Add the readable trigram text to our set of unique trigrams
    uniqueTrigramTexts.add(readableTrigramText);

    // Only add the trigram if it doesn't already exist in our dictionary
    if (!trigramDictionary[trigramKey]) {
      trigramDictionary[trigramKey] = {
        readableText: readableTrigramText,
        wordIds: wordIds,
      };
    }
  }

  console.log("Trigram Dictionary:", trigramDictionary);
  return {
    trigrams: trigramDictionary,
    uniqueTrigramTexts: uniqueTrigramTexts,
  };
}

export {
  cleanDocxTextWord,
  createRollingWindows,
  cleanWord,
  removeStopWords,
  generateStructuredTrigrams,
  stopWords,
};
