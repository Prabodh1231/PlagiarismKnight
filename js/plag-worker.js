import * as pdfjsLib from "./pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

onmessage = async function (event) {
  try {
    // **Outer try-catch to wrap the entire onmessage handler**
    const { pdfBuffers, rollingWindows, colors, action } = event.data;

    if (action !== "process") {
      postMessage({ type: "error", message: "Invalid action" });
      return;
    }

    let colorIndex = 0;

    let allResults = [];

    const processPromises = pdfBuffers.map(async (pdfData, i) => {
      try {
        const text = await extractTextFromPDFBuffer(
          pdfData.arrayBuffer,
          pdfData.name
        );
        let databaseCleanedText = cleanWord(text);
        databaseCleanedText = slidingWindow(databaseCleanedText);

        const color = colors[i % colors.length]; // Cycle through colors if there are more files than colors

        let commonIds = findMatchingIds(rollingWindows, databaseCleanedText, 8);

        postMessage({
          type: "progress",
          file: pdfData.name,
          progress: (i + 1) / pdfBuffers.length,
        });

        return { Ids: commonIds, file: pdfData.name, color: color };
      } catch (error) {
        console.error(`Error processing ${pdfData.name}:`, error);
        return null; // Or handle errors in a way that fits your needs
      }
    });

    // Wait for all files to be processed in parallel
    const results = await Promise.all(processPromises);
    allResults = results.filter((result) => result !== null); // Remove any nulls if there were errors

    // Send the final results back to the main thread
    postMessage({
      type: "result",
      results: allResults,
    });
  } catch (error) {
    console.error("Full Worker Error:", error); // Log full error in worker
    postMessage({
      type: "error",
      message: "Worker error: " + String(error), // Send stringified error
      errorDetail: error, // Optionally send the error object itself (may or may not be serializable)
    });
  }
};
// ... (rest of plag-worker.js code remains the same) ...

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
 * @param {File} file - PDF file to process
 * @returns {Promise<string>} Extracted text content
 * @throws {Error} If PDF processing fails
 */
// Improved text extraction from PDF with better error handling

async function extractTextFromPDFBuffer(arrayBuffer, filename) {
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    // Process each page of the PDF
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Improve text extraction to maintain better word boundaries
      const pageText = textContent.items
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ");

      fullText += pageText + " ";
    }

    return fullText || "No text content found in PDF.";
  } catch (error) {
    throw new Error(`Error extracting text from ${filename}: ${error.message}`);
  }
}

/**
 * Improved sliding window function with better memory management
 */
function slidingWindow(pdfText) {
  const pdfTextArray = pdfText.split(/\s+/).filter((word) => word.length > 0);
  const result = [];
  const windowSize = 12;

  // Use a more efficient approach for large documents
  if (pdfTextArray.length > 10000) {
    // For very large documents, sample windows instead of creating all of them
    const samplingRate = Math.max(1, Math.floor(pdfTextArray.length / 1000));

    for (let i = 0; i <= pdfTextArray.length - windowSize; i += samplingRate) {
      result.push(pdfTextArray.slice(i, i + windowSize));
    }
  } else {
    // For normal sized documents, create all windows
    for (let i = 0; i <= pdfTextArray.length - windowSize; i++) {
      result.push(pdfTextArray.slice(i, i + windowSize));
    }
  }

  return result;
}

/**
 * Finds document IDs that match query terms based on a minimum similarity threshold.
 *
 * @param {Array<Object>} documentWindows - An array of document windows, each containing content terms and IDs
 * Each window should have {contents: Array<string>, ids: Array<string>}
 * @param {Array<Array<string>|Set<string>>} queryTerms - Array of query term collections
 * @param {number} minMatchThreshold - Minimum number of matching terms required (default: 8)
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
