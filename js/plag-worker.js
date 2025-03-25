import * as pdfjsLib from "./pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

onmessage = async function (event) {
  try {
    // **Outer try-catch to wrap the entire onmessage handler**
    const { pdfBuffers, docxArrayWord, action } = event.data;

    if (action !== "process") {
      postMessage({ type: "error", message: "Invalid action" });
      return;
    }

    // Clone the docx array to avoid mutating the original
    let docxTextWord = JSON.parse(JSON.stringify(docxArrayWord));
    docxTextWord = cleanDocxTextWord(docxTextWord);

    let docxlength = docxTextWord.length;

    // Create rolling windows from the DOCX content for comparison
    let rollingWindows = createRollingWindows(docxTextWord, 12);

    let colorIndex = 0;
    const colors = [
      { name: "Classic Yellow", hex: "#FFEB3B" },
      { name: "Soft Yellow", hex: "#FFF59D" },
      { name: "Pale Yellow", hex: "#FFFDE7" },
      { name: "Mint Green", hex: "#E8F5E9" },
      { name: "Light Green", hex: "#C8E6C9" },
      { name: "Seafoam Green", hex: "#B2DFDB" },
      { name: "Sky Blue", hex: "#E3F2FD" },
      { name: "Baby Blue", hex: "#BBDEFB" },
      { name: "Powder Blue", hex: "#B3E5FC" },
      { name: "Peach", hex: "#FFE0B2" },
      { name: "Apricot", hex: "#FFCCBC" },
      { name: "Coral", hex: "#FFCDD2" },
      { name: "Rose", hex: "#F8BBD0" },
      { name: "Light Pink", hex: "#F5E6E8" },
      { name: "Blush Pink", hex: "#FCE4EC" },
      { name: "Lavender", hex: "#F3E5F5" },
      { name: "Light Purple", hex: "#EDE7F6" },
      { name: "Periwinkle", hex: "#E8EAF6" },
      { name: "Cream", hex: "#FFF8E1" },
      { name: "Ivory", hex: "#FAFAFA" },
      { name: "Mint Cream", hex: "#E0F2F1" },
      { name: "Azure", hex: "#E1F5FE" },
      { name: "Honeydew", hex: "#F1F8E9" },
      { name: "Linen", hex: "#FFF3E0" },
    ];

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
        colorIndex = (colorIndex + 1) % colors.length;

        // Find matching IDs using the improved matching algorithm
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
      docxLength: docxlength,
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

  for (const input of inputContents) {
    // Optimize input for faster lookups if it's an array and potentially large
    const inputSet = Array.isArray(input) ? new Set(input) : null;

    for (const window of rollingWindows) {
      let matchedCount = 0;
      let currentWindowMatchedIds = [];

      for (let i = 0; i < window.contents.length; i++) {
        const content = window.contents[i];
        const id = window.ids[i];

        // Use set for faster lookup if input was converted to set
        const isMatch = inputSet
          ? inputSet.has(content)
          : input.includes(content);

        if (isMatch) {
          matchedCount++;
          currentWindowMatchedIds.push(id); // Temporarily store IDs for the current window
        }
      }

      if (matchedCount >= matchThreshold) {
        // Add all matched IDs from the current window to the Set
        currentWindowMatchedIds.forEach((id) => matchingIds.add(id));
      }
    }
  }

  return Array.from(matchingIds); // Convert Set to Array for the final result
}
