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

    // Process each PDF file sequentially to avoid memory issues
    for (let i = 0; i < pdfBuffers.length; i++) {
      const pdfData = pdfBuffers[i];
      try {
        // Extract and clean text from PDF using the ArrayBuffer
        const text = await extractTextFromPDFBuffer(
          pdfData.arrayBuffer,
          pdfData.name
        );
        let databaseCleanedText = cleanWord(text);
        databaseCleanedText = slidingWindow(databaseCleanedText);

        let color = colors[colorIndex];
        colorIndex++;

        // Find matching IDs using the improved matching algorithm
        // console.log(`Processing ${pdfData.name}...`);

        let commonIds = findMatchingIds(rollingWindows, databaseCleanedText, 8);

        allResults.push({ Ids: commonIds, file: pdfData.name, color: color });

        // Send progress update
        postMessage({
          type: "progress",
          file: pdfData.name,
          progress: (i + 1) / pdfBuffers.length,
        });
      } catch (error) {
        console.error(`Error processing ${pdfData.name}:`, error);
        // Don't stop the overall process if one file fails
      }
    }

    // Send the final results back to the main thread
    postMessage({
      type: "result",
      results: allResults,
    });
  } catch (error) {
    // **Catch any error in onmessage itself**
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

function findMatchingIds(rollingWindows, inputContents, matchThreshold = 8) {
  let matchingIds = new Set(); // Use a Set to store unique IDs directly
  // let totalNonmatchedCount = 0;
  for (const input of inputContents) {
    // Optimize input for faster lookups if it's an array and potentially large
    const inputSet = input instanceof Set ? input : new Set(input);

    for (const window of rollingWindows) {
      let matchedCount = 0;
      let nonMatchedCount = 0;
      let currentWindowMatchedIds = [];

      for (let i = 0; i < window.contents.length; i++) {
        const content = window.contents[i];
        const id = window.ids[i];

        if (inputSet.has(content)) {
          matchedCount++;
          currentWindowMatchedIds.push(id);
        } else {
          nonMatchedCount++;

          if (nonMatchedCount > window.contents.length - matchThreshold) {
            // totalNonmatchedCount++;
            break;
          }
        }
      }

      if (matchedCount >= matchThreshold) {
        currentWindowMatchedIds.forEach((id) => matchingIds.add(id));
      }
    }
  }
  // console.log("Total non-matched words:", totalNonmatchedCount);
  return Array.from(matchingIds); // Convert Set to Array for the final result
}
