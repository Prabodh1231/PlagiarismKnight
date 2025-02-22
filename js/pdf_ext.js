/**
 * This script handles the drag-and-drop functionality for PDF and DOCX files,
 * extracts text from the files, and compares the text for plagiarism detection.
 * @author [Prabodh Singh]
 * @version 1.0.2
 */

// Import PDF.js library and configure worker
import * as pdfjsLib from "./pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

// DOM element references
const checkPlagiarismButton = document.getElementById("checkplagiarism");
const outputDiv = document.getElementById("output1");
const outputDisplayDocx = document.getElementById("output2");
const resultOutput = document.getElementById("output3");
const fileInputPdf = document.getElementById("fileInput1");
const fileInputDocx = document.getElementById("fileInput2");
const uploadAreaPdf = document.getElementById("uploadAreaPdf");
const uploadAreaDocx = document.getElementById("uploadAreaDocx");
const previewPdf = document.getElementById("preview1");
const previewDocx = document.getElementById("preview2");
const processingDialog = document.getElementById("processing-dialog"); // More descriptive name
const progressBar = document.getElementById("progress-bar");

// Global state variables for storing dropped files - Consider using a single object to manage file state
let uploadedFiles = {
  pdfFiles: [],
  docxFile: null,
};

/**
 * Prevents default drag and drop behavior
 * @param {Event} e - The drag event
 */
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Add event listeners for all drag and drop events
const dragEventNames = ["dragenter", "dragover", "dragleave", "drop"];
[uploadAreaPdf, uploadAreaDocx].forEach((uploadArea) => {
  dragEventNames.forEach((eventName) => {
    uploadArea.addEventListener(eventName, preventDefaults);
  });
});

/**
 * Debounces a function call
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

/**
 * Handles file upload preview generation
 * @param {FileList} files - The list of files to process
 * @param {string} previewElementId - ID of the preview container element
 */
const handleFilePreview = debounce((files, previewElement) => {
  if (!previewElement) {
    console.error(`Preview element not found.`); // More generic error message
    return;
  }
  previewElement.innerHTML = ""; // More efficient to set innerHTML to empty string

  const fragment = document.createDocumentFragment(); // Use document fragment for better performance
  for (const file of files) {
    const fileItem = document.createElement("p");
    fileItem.textContent = `File: ${file.name} (${(file.size / 1024).toFixed(
      2
    )} KB)`;
    fragment.appendChild(fileItem);
  }
  previewElement.appendChild(fragment); // Append fragment to DOM once
}, 300);

/**
 * Initialize drag and drop event handlers when DOM is loaded
 */
document.addEventListener("DOMContentLoaded", () => {
  /**
   * Handles dragover event - No changes needed, efficient and clear
   * @param {DragEvent} event - The drag event
   */
  const handleDragOver = (event) => {
    event.preventDefault();
    event.currentTarget.classList.add("dragover");
  };
  /**
   * Handles dragleave event - No changes needed, efficient and clear
   * @param {DragEvent} event - The drag event
   */

  const handleDragLeave = (event) => {
    event.currentTarget.classList.remove("dragover");
  };
  /**
   * Handles file drop event - Refactored to use uploadedFiles object and handleFilePreview function
   * @param {DragEvent} event - The drop event
   */

  const handleDrop = (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove("dragover");
    event.currentTarget.classList.remove("dragging");

    const files = Array.from(event.dataTransfer.files);
    const uploadAreaId = event.currentTarget.id;

    if (uploadAreaId === "uploadAreaPdf") {
      uploadedFiles.pdfFiles = files.filter(
        (file) => file.type === "application/pdf"
      );
      handleFilePreview(uploadedFiles.pdfFiles, previewPdf);
    } else if (uploadAreaId === "uploadAreaDocx") {
      uploadedFiles.docxFile =
        files.find((file) => file.name.endsWith(".docx")) || null; // Ensure null if no docx
      handleFilePreview([uploadedFiles.docxFile].filter(Boolean), previewDocx); // Handle null docxFile correctly
    }
  };

  // Add event listeners to upload areas -  More efficient to loop and bind once
  [uploadAreaPdf, uploadAreaDocx].forEach((uploadArea) => {
    uploadArea.addEventListener("dragover", handleDragOver);
    uploadArea.addEventListener("dragleave", handleDragLeave);
    uploadArea.addEventListener("drop", handleDrop);
  });

  // File input event handlers for manual file selection - Directly use handleFilePreview
  fileInputPdf.addEventListener("change", (event) => {
    uploadedFiles.pdfFiles = Array.from(event.target.files); // Update global state
    handleFilePreview(uploadedFiles.pdfFiles, previewPdf);
  });

  fileInputDocx.addEventListener("change", (event) => {
    uploadedFiles.docxFile = event.target.files[0] || null; // Update global state, handle no file selected
    handleFilePreview([uploadedFiles.docxFile].filter(Boolean), previewDocx);
  });
  /**
   * Handle plagiarism check button click - No major changes here, good structure
   * Initiates text extraction and comparison process
   */

  checkPlagiarismButton.addEventListener("click", async () => {
    try {
      outputDiv.textContent = "Processing files..."; // More concise loading message
      await handleExtractAndCompare(); // Renamed function for clarity
    } catch (error) {
      outputDiv.textContent = `Error: ${error.message}`;
      console.error("Plagiarism check failed:", error);
    }
  });
});

/**
 * Main handler for text extraction process
 * @returns {Promise<void>}
 * @throws {Error} If file validation fails
 */
async function handleExtractAndCompare() {
  const pdfFiles = uploadedFiles.pdfFiles; // Get files from global state
  const docxFile = uploadedFiles.docxFile; // Get file from global state

  validateFiles(pdfFiles, docxFile); // Validate files upfront // No need for merging and sorting based on timestamps as per current logic, simplifying

  const finalPdfFiles = pdfFiles;
  const finalDocx = docxFile;

  processingDialog.showModal(); // Show dialog before processing
  progressBar.value = 0;

  try {
    await extractTextAndCompare(finalPdfFiles, finalDocx); // More descriptive function name
  } finally {
    processingDialog.close(); // Ensure dialog is closed even if error occurs
  }
}

// /**
//  * Retrieves PDF files from file input
//  * @returns {File[]} Array of PDF files
//  */
// function getPdfFiles() {
//   return Array.from(fileInputPdf.files);
// }

// /**
//  * Retrieves DOCX file from file input
//  * @returns {File|null} The DOCX file or null
//  */
// function getDocxFile() {
//   return fileInputDocx.files[0];
// }

/**
 * Validates that required files are present
 * @param {File[]} pdfFiles - Array of PDF files
 * @param {File} docxFile - DOCX file
 * @throws {Error} If required files are missing
 */
function validateFiles(pdfFiles, docxFile) {
  if (!pdfFiles.length) {
    throw new Error("Please upload at least one PDF file.");
  }
  if (!docxFile) {
    throw new Error("Please upload a .docx file.");
  }
}

function mergePdfFiles(pdfFiles) {
  if (pdfFiles.length && droppedPdfFiles.length) {
    return [...pdfFiles, ...droppedPdfFiles].sort(
      (a, b) => b.lastModified - a.lastModified
    );
  }
  return pdfFiles.length ? pdfFiles : droppedPdfFiles;
}

/**
 * Extracts text from multiple PDF files and compares it with the text extracted from a DOCX file.
 * Highlights common elements between the DOCX text and each PDF text.
 *
 * @param {File[]} pdfFiles - An array of PDF files to extract text from.
 * @param {File} docxFile - A DOCX file to extract text from.
 * @returns {Promise<void>} - A promise that resolves when the text extraction and comparison are complete.
 * @throws {Error} - Throws an error if there is an issue processing the DOCX or PDF files.
 */
async function extractTextAndCompare(pdfFiles, docxFile) {
  let docxText;

  if (docxFile && docxFile.name.endsWith(".docx")) {
    docxText = await extractDocxText(docxFile);
    outputDisplayDocx.innerHTML = docxText;
  }

  let docxArray = separateWordsAndTags(convertToObjects(docxText));
  let docxTextWord = JSON.parse(JSON.stringify(docxArray.words));
  docxTextWord = cleanDocxTextWord(docxTextWord);
  let rollingWindows = createRollingWindows(docxTextWord, 11);

  let colorIndex = 0; // Initialize the color index
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

  // Update UI to show processing status
  outputDiv.textContent = "Processing PDFs...";

  /**
   * Process each PDF file and extract text
   * Returns array of promises for parallel processing
   */
  const pdfExtractionPromises = pdfFiles.map(async (file) => {
    try {
      // Extract and clean text from PDF
      const text = await extractTextFromPDF(file);
      let databaseCleanedText = cleanWord(text);
      databaseCleanedText = slidingWindow(databaseCleanedText);

      let color = colors[colorIndex];
      colorIndex = (colorIndex + 1) % colors.length; // Move to the next color, looping if necessary

      let commonIds = findMatchingIds(rollingWindows, databaseCleanedText, 8);
      console.log("Processing:", file.name);

      allResults.push({ Ids: commonIds, file: file.name, color: color });
    } catch (error) {
      console.error(`Error processing ${file.name}: ${error.message}`);
      return `Error processing ${file.name}: ${error.message}`;
    }
  });

  // Wait for all PDF processing to complete
  await Promise.allSettled(pdfExtractionPromises);

  // Update DocxArray with highlighted text
  docxArray.words = addSpanTagsAndModify(docxArray.words, allResults);

  let finalResult = combineWordsAndTagsInOrder(docxArray);
  resultOutput.innerHTML = finalResult;
}

/**
 * Extracts text content from a PDF file
 * @param {File} file - PDF file to process
 * @returns {Promise<string>} Extracted text content
 * @throws {Error} If PDF processing fails
 */
async function extractTextFromPDF(file) {
  try {
    // Convert file to ArrayBuffer for PDF.js
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    // Process each page of the PDF
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Extract and join text items from page
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += `Page ${i}:\n${pageText}\n\n`;
    }

    return fullText || "No text content found in PDF.";
  } catch (error) {
    throw new Error(
      `Error extracting text from ${file.name}: ${error.message}`
    );
  }
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

async function extractDocxText(file) {
  return new Promise((resolve, reject) => {
    // Simplified Promise creation
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result;
        const result = await mammoth.convertToHtml({
          arrayBuffer: arrayBuffer,
        });
        resolve(result.value);
      } catch (error) {
        reject("Error converting DOCX to HTML: " + error.message); // More informative error
      }
    };
    reader.onerror = () => reject("Error reading file"); // Simplified error handling
    reader.readAsArrayBuffer(file);
  });
}

function convertToObjects(mammothString) {
  let id = 0;
  const result = [];

  // List of valid HTML tags based on Mammoth.js output
  const validTags = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6", // Headings
    "p", // Paragraph
    "ul",
    "ol",
    "li", // Lists
    "strong",
    "em",
    "u",
    "sup",
    "sub", // Text formatting
    "a", // Links
    "img", // Images
    "table",
    "tr",
    "td",
    "th", // Tables
    "br", // Line breaks
    "blockquote", // Blockquotes
    "pre",
    "code", // Code
  ];

  // Helper function to find the next valid tag
  function findNextValidTag(str, startPos) {
    let pos = startPos;
    while (pos < str.length) {
      if (str[pos] === "<") {
        const potentialTagEnd = str.indexOf(">", pos);
        if (potentialTagEnd !== -1) {
          const tagContent = str.substring(pos, potentialTagEnd + 1);
          const tagMatch = tagContent.match(/^<\/?([a-zA-Z0-9]+)/);
          if (tagMatch && validTags.includes(tagMatch[1])) {
            return pos;
          }
        }
      }
      pos++;
    }
    return -1;
  }

  // Helper function to process a single string
  function processString(str) {
    const result = [];
    let currentPosition = 0;

    while (currentPosition < str.length) {
      if (str[currentPosition] === "<") {
        const nextValidTagPos = findNextValidTag(str, currentPosition);

        if (nextValidTagPos === currentPosition) {
          // We're at a valid tag
          const tagEnd = str.indexOf(">", currentPosition);
          const tagContent = str.substring(currentPosition, tagEnd + 1);
          const tagMatch = tagContent.match(/^<\/?([a-zA-Z0-9]+)/);

          const tagObject = {
            id: id++,
            type: "tag",
            content: tagContent,
            tagName: tagMatch[1],
          };

          result.push(tagObject);
          currentPosition = tagEnd + 1;
        } else if (nextValidTagPos === -1) {
          // No more valid tags, treat rest as text
          const words = str
            .substring(currentPosition)
            .split(" ")
            .filter((word) => word.length > 0);
          words.forEach((word) => {
            result.push({
              id: id++,
              type: "word",
              content: word,
            });
          });
          break;
        } else {
          // Text until next valid tag
          const textContent = str.substring(currentPosition, nextValidTagPos);
          const words = textContent
            .split(" ")
            .filter((word) => word.length > 0);
          words.forEach((word) => {
            result.push({
              id: id++,
              type: "word",
              content: word,
            });
          });
          currentPosition = nextValidTagPos;
        }
      } else {
        // Handle regular text until next '<'
        const nextTag = str.indexOf("<", currentPosition);
        const wordEnd = nextTag === -1 ? str.length : nextTag;

        const words = str
          .substring(currentPosition, wordEnd)
          .split(" ")
          .filter((word) => word.length > 0);

        words.forEach((word) => {
          result.push({
            id: id++,
            type: "word",
            content: word,
          });
        });

        currentPosition = wordEnd;
      }
    }

    return result;
  }

  // Process each item in the input array
  const objects = processString(mammothString);
  result.push(...objects);

  return result;
}

function separateWordsAndTags(inputArray) {
  const words = [];
  const tags = [];

  inputArray.forEach((item) => {
    if (item.type === "word") {
      words.push({
        id: item.id,
        content: item.content,
        modified: false,
        color: "white",
      });
    } else if (item.type === "tag") {
      tags.push({ id: item.id, content: item.content });
    }
  });

  return { words, tags };
}

function cleanDocxTextWord(wordsArray) {
  // Clean each item in the array
  wordsArray.forEach((item) => {
    if (item.content) {
      const cleanedContent = cleanWord(item.content);
      item.content = cleanedContent;
    }
    delete item.modified; // Remove the 'modified' property if it exists
    delete item.color; // Remove the 'color' property if it exists
  });

  // Filter out items that have only special characters in 'content'
  return wordsArray.filter((item) => {
    const hasValidContent = /[a-zA-Z0-9]/.test(item.content);
    return hasValidContent;
  });
}

function createRollingWindows(data, windowSize = 11) {
  let result = [];

  for (let i = 0; i <= data.length - windowSize; i++) {
    let windowSlice = data.slice(i, i + windowSize);

    result.push({
      ids: windowSlice.map((item) => item.id),
      contents: windowSlice.map((item) => item.content),
    });
  }

  return result;
}

function findMatchingIds(rollingWindows, inputContents, matchThreshold = 8) {
  let matchingIds = [];
  for (let input of inputContents) {
    for (let window of rollingWindows) {
      // Get the IDs of matching contents
      let matchedItems = window.contents
        .map((content, index) =>
          input.includes(content) ? window.ids[index] : null
        )
        .filter((id) => id !== null); // Remove null values (non-matching items)

      // If at least `matchThreshold` matches, add these IDs to the result
      if (matchedItems.length >= matchThreshold) {
        matchingIds.push(...matchedItems);
      }
    }
  }

  return [...new Set(matchingIds)]; // Remove duplicates if any
}

function slidingWindow(pdfText) {
  let pdfTextArray = pdfText.split(" ");
  let result = [];

  for (let i = 0; i <= pdfTextArray.length - 10; i++) {
    let window = pdfTextArray.slice(i, i + 10);
    result.push(window);
  }

  return result;
}

function addSpanTagsAndModify(array, allResults) {
  return array.map((item) => {
    // Check if any result's Ids contain this item's id
    const matchingResult = allResults.find(
      (result) => result.Ids.includes(item.id) && !item.modified
    );

    if (matchingResult) {
      // Wrap the content in a span tag with the color from the matching result
      const modifiedContent = `<span style="background-color: ${matchingResult.color.hex}">${item.content}</span>`;
      console.log(modifiedContent);
      return {
        ...item,
        content: modifiedContent,
        modified: true,
        color: matchingResult.color.name,
      };
    }
    return item; // Return the item unchanged if no matching result or already modified
  });
}

function combineWordsAndTagsInOrder(data) {
  // Combine words and tags into a single array
  const combined = [...data.words, ...data.tags];

  // Sort by id
  combined.sort((a, b) => a.id - b.id);

  // Initialize result array
  let result = [];

  for (let i = 0; i < combined.length; i++) {
    const currentItem = combined[i];
    const nextItem = combined[i + 1];

    // Add the current item's content
    result.push(currentItem.content);

    // Add space if:
    // 1. This is not the last item
    // 3. Next item is also a word
    // 4. Current item's content is not a single character (like '/')
    if (nextItem && currentItem.content.length > 1) {
      result.push(" ");
    }
  }

  // Join the final array
  return result.join("");
}
