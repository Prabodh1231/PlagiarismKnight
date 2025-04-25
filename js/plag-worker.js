import * as pdfjsLib from "./pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

// Configuration constants
const CONFIG = {
  WINDOW_SIZE: 12,
  LARGE_DOC_THRESHOLD: 10000,
  SAMPLING_RATE_DIVISOR: 1000,
  SLIDING_MATCH_THRESHOLD: 8,
  TRIGRAM_MATCH_THRESHOLD: 21,
};

/**
 * Validates the incoming message data
 * @param {Object} data - The data to validate
 * @throws {Error} If validation fails
 */
function validateMessageData(data) {
  if (!data) {
    throw new Error("No data received");
  }

  const { pdfBuffers, rollingWindows, docx_trigrams, colors, action } = data;

  if (!pdfBuffers || !Array.isArray(pdfBuffers)) {
    throw new Error("Invalid or missing PDF buffers");
  }

  if (!rollingWindows || !Array.isArray(rollingWindows)) {
    throw new Error("Invalid or missing rolling windows data");
  }

  if (!docx_trigrams || !docx_trigrams.trigrams) {
    throw new Error("Invalid or missing trigrams data");
  }

  if (!colors || !Array.isArray(colors)) {
    throw new Error("Invalid or missing colors array");
  }

  if (action !== "process") {
    throw new Error("Invalid action");
  }

  return { pdfBuffers, rollingWindows, docx_trigrams, colors };
}

onmessage = async function (event) {
  try {
    const { pdfBuffers, rollingWindows, docx_trigrams, colors } =
      validateMessageData(event.data);

    const trigramsData = {
      trigrams: docx_trigrams.trigrams,
      uniqueTrigramTexts: new Set(docx_trigrams.uniqueTrigramTexts),
    };

    let allResults = [];
    console.log("Processing PDF files:", pdfBuffers.length);

    try {
      const processPromises = pdfBuffers.map(async (pdfData, i) => {
        if (!pdfData || !pdfData.arrayBuffer) {
          throw new Error(`Invalid PDF data at index ${i}`);
        }

        try {
          const text = await extractTextFromPDFBuffer(
            pdfData.arrayBuffer,
            pdfData.name
          );
          // Free up the original buffer after extraction
          pdfData.arrayBuffer = null;

          console.log(`Extracted text from ${pdfData.name}`);

          if (!text) {
            throw new Error(`No text extracted from ${pdfData.name}`);
          }

          let databaseCleanedText = cleanWord(text);

          let databaseCleanedText01 = slidingWindow(databaseCleanedText);
          // Free up memory

          let textWithoutStopWords = removeStopWords(databaseCleanedText);

          databaseCleanedText = null;

          let textTrigrams = generateTextTrigrams(textWithoutStopWords);
          // Free up memory
          textWithoutStopWords = null;

          const color = colors[i % colors.length];

          const [commonIds, trigramComparison] = await Promise.all([
            findMatchingIds(
              rollingWindows,
              databaseCleanedText01,
              CONFIG.SLIDING_MATCH_THRESHOLD
            ),
            compareTrigramSets(
              trigramsData,
              textTrigrams,
              CONFIG.TRIGRAM_MATCH_THRESHOLD
            ),
          ]);

          console.log(trigramComparison.matchedWordIds);
          // Free up memory
          databaseCleanedText01 = null;
          textTrigrams = null;

          let finalResult = Array.from(
            new Set([...commonIds, ...trigramComparison.matchedWordIds])
          );

          postMessage({
            type: "progress",
            file: pdfData.name,
            filesCompleted: 1,
          });

          return { Ids: finalResult, file: pdfData.name, color: color };
        } catch (error) {
          console.error(`Error processing ${pdfData.name}:`, error);
          return null;
        }
      });

      let results = await Promise.all(processPromises);
      allResults = results.filter((result) => result !== null);

      postMessage({
        type: "result",
        results: allResults,
      });
    } finally {
      // Clean up references
      trigramsData.trigrams = null;
      trigramsData.uniqueTrigramTexts.clear();
    }
  } catch (error) {
    console.error("Full Worker Error:", error);
    postMessage({
      type: "error",
      message: "Worker error: " + String(error),
      errorDetail: error,
    });
  }
};

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

/**
 * Extracts text content from a PDF file
 * @param {ArrayBuffer} arrayBuffer - PDF file data as ArrayBuffer
 * @param {string} filename - Name of the PDF file
 * @returns {Promise<string>} Extracted text content
 * @throws {Error} If PDF processing fails
 */
async function extractTextFromPDFBuffer(arrayBuffer, filename) {
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textChunks = [];

    // Process each page of the PDF
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Process text items in chunks for better memory efficiency
      const pageText = textContent.items
        .reduce((acc, item) => {
          if (item.str.trim()) {
            acc.push(item.str);
          }
          return acc;
        }, [])
        .join(" ");

      textChunks.push(pageText);

      // Free up page resources
      page.cleanup();
    }

    // Join all chunks with proper spacing
    const fullText = textChunks.join(" ").replace(/\s+/g, " ").trim();

    // Clear the chunks array
    textChunks = [];

    return fullText || "No text content found in PDF.";
  } catch (error) {
    throw new Error(`Error extracting text from ${filename}: ${error.message}`);
  }
}

/**
 * Creates sliding windows of words from input text
 * @param {string} pdfText - The cleaned text from PDF
 * @returns {Array<Array<string>>} Array of word windows
 */
function slidingWindow(pdfText) {
  const pdfTextArray = pdfText.split(/\s+/).filter((word) => word.length > 0);
  const result = [];
  const windowSize = CONFIG.WINDOW_SIZE;

  // Early return if text is shorter than window size
  if (pdfTextArray.length < windowSize) {
    return [pdfTextArray];
  }

  // Preallocate approximate array size for better performance
  result.length = Math.ceil(pdfTextArray.length / windowSize);

  // Use a more efficient approach for large documents
  if (pdfTextArray.length > CONFIG.LARGE_DOC_THRESHOLD) {
    // For very large documents, sample windows instead of creating all of them
    const samplingRate = Math.max(
      1,
      Math.floor(pdfTextArray.length / CONFIG.SAMPLING_RATE_DIVISOR)
    );

    // Use a reusable window array to reduce memory allocations
    const window = new Array(windowSize);
    for (let i = 0; i <= pdfTextArray.length - windowSize; i += samplingRate) {
      for (let j = 0; j < windowSize; j++) {
        window[j] = pdfTextArray[i + j];
      }
      result.push([...window]);
    }
  } else {
    // For normal sized documents, create all windows
    // Use a reusable window array here too
    const window = new Array(windowSize);
    for (let i = 0; i <= pdfTextArray.length - windowSize; i++) {
      for (let j = 0; j < windowSize; j++) {
        window[j] = pdfTextArray[i + j];
      }
      result.push([...window]);
    }
  }

  return result;
}

// Convert stopWords array to Set for O(1) lookups
const stopWordsSet = new Set([
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
  "aren't",
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
  "couldn't",
  "d",
  "did",
  "didn",
  "didn't",
  "do",
  "does",
  "doesn",
  "doesn't",
  "doing",
  "don",
  "don't",
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
  "hadn't",
  "has",
  "hasn",
  "hasn't",
  "have",
  "haven",
  "haven't",
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
  "isn't",
  "it",
  "it's",
  "its",
  "itself",
  "just",
  "ll",
  "m",
  "ma",
  "me",
  "mightn",
  "mightn't",
  "more",
  "most",
  "mustn",
  "mustn't",
  "my",
  "myself",
  "needn",
  "needn't",
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
  "shan't",
  "she",
  "she's",
  "should",
  "should've",
  "shouldn",
  "shouldn't",
  "so",
  "some",
  "such",
  "t",
  "than",
  "that",
  "that'll",
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
  "wasn't",
  "we",
  "were",
  "weren",
  "weren't",
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
  "won't",
  "wouldn",
  "wouldn't",
  "y",
  "you",
  "you'd",
  "you'll",
  "you're",
  "you've",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

/**
 * Removes common stop words from text
 * @param {Array<string>} pdfText - Array of words to process
 * @returns {Array<string>} Array of words with stop words removed
 */
function removeStopWords(pdfText) {
  // Remove stop words from the text using Set for O(1) lookups
  const pdfTextArray = pdfText.split(/\s+/).filter((word) => word.length > 0);
  return pdfTextArray.filter((item) => !stopWordsSet.has(item));
}

/**
 * Generates a set of trigrams from a plain text array.
 * @param {Array<string>} textWords - Array of words
 * @returns {Set<string>} Set of space-separated trigram strings
 */
function generateTextTrigrams(textWords) {
  // If we have fewer than 3 words, we can't make trigrams
  if (textWords.length < 3) {
    return new Set();
  }

  const trigramSet = new Set();
  const numTrigrams = textWords.length - 2;
  const trigrams = new Array(numTrigrams);

  // Pre-join spaces for efficiency
  const space = " ";

  // Generate trigrams by sliding a window of 3 words
  for (let i = 0; i < numTrigrams; i++) {
    // Using array join is faster than template literals for this case
    const trigram = [textWords[i], textWords[i + 1], textWords[i + 2]].join(
      space
    );
    trigramSet.add(trigram);
  }

  return trigramSet;
}

/**
 * Finds document IDs that match query terms based on a minimum similarity threshold.
 *
 * @param {Array<Object>} documentWindows - An array of document windows, each containing content terms and IDs
 * Each window should have {contents: Array<string>, ids: Array<string>}
 * @param {Array<Array<string>|Set<string>>} queryTerms - Array of query term collections
 * @param {number} minMatchThreshold - Minimum number of matching terms required
 * @returns {Array<string>} Array of unique document IDs that meet the matching criteria
 */
function findMatchingIds(documentWindows, queryTerms, minMatchThreshold = 8) {
  const matchingDocumentIds = new Set();
  for (const currentQuerySet of queryTerms) {
    const termSet = new Set(currentQuerySet);

    for (const window of documentWindows) {
      let matchedTermCount = 0;
      let nonMatchedTermCount = 0;
      let currentWindowMatchingIds = [];

      for (let i = 0; i < window.contents.length; i++) {
        const term = window.contents[i];
        const documentId = window.ids[i];

        if (termSet.has(term)) {
          matchedTermCount++;
          currentWindowMatchingIds.push(documentId);
        } else {
          nonMatchedTermCount++;

          if (
            nonMatchedTermCount >
            window.contents.length - minMatchThreshold
          ) {
            break;
          }
        }
      }

      if (matchedTermCount >= minMatchThreshold) {
        currentWindowMatchingIds.forEach((id) => matchingDocumentIds.add(id));
      }
    }
  }
  return Array.from(matchingDocumentIds); // Convert Set to Array for the final result
}

/**
 * Compares two sets of trigrams to check for significant overlap.
 * @param {Object} structuredTrigrams - Object with trigrams and uniqueTrigramTexts
 * @param {Set<string>} textTrigrams - Set of trigram strings
 * @param {number} matchThreshold - Minimum number of matches to consider significant
 * @returns {Object} Result with match status and matched word IDs
 */
function compareTrigramSets(
  structuredTrigrams,
  textTrigrams,
  matchThreshold = 8
) {
  // Get the set of unique trigram texts from the first input
  const uniqueTrigramTexts = structuredTrigrams.uniqueTrigramTexts;

  // OPTIMIZATION: Quick check using set operations
  // Create a union of both sets to see potential overlap
  const unionSet = new Set([...uniqueTrigramTexts, ...textTrigrams]);

  // Calculate potential overlap based on set sizes
  const set1Size = uniqueTrigramTexts.size;
  const set2Size = textTrigrams.size;
  const unionSize = unionSet.size;

  // The number of overlapping elements is: set1Size + set2Size - unionSize
  const potentialOverlap = set1Size + set2Size - unionSize;

  // If the potential overlap is below our threshold, return early
  if (potentialOverlap < matchThreshold) {
    return {
      isMatch: false,
      matchCount: potentialOverlap,
      matchedWordIds: [],
    };
  }

  // If we're here, there's enough potential overlap, so collect matching IDs
  const matchedWordIds = new Set();
  let alikecount = 0;

  // Direct check for matching trigrams and collect IDs with early return optimization
  for (const key in structuredTrigrams.trigrams) {
    const entry = structuredTrigrams.trigrams[key];
    const entryText = entry.readableText;

    // Check if this trigram exists in the text trigrams set
    if (textTrigrams.has(entryText)) {
      entry.wordIds.forEach((id) => matchedWordIds.add(id));
      alikecount++;

      // OPTIMIZATION: Early return if we've found all possible matches
      if (alikecount === potentialOverlap) {
        console.log("All elements match, returning early.");
        return {
          isMatch: alikecount >= matchThreshold,
          matchCount: alikecount,
          matchedWordIds: Array.from(matchedWordIds),
        };
      }
    }
  }

  return {
    isMatch: alikecount >= matchThreshold, // Use alikecount for match status
    matchCount: alikecount,
    matchedWordIds: Array.from(matchedWordIds),
  };
}
