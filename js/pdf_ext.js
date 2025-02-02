/**
 * This script handles the drag-and-drop functionality for PDF and DOCX files,
 * extracts text from the files, and compares the text for plagiarism detection.
 * @author [Your Name]
 * @version 1.0.0
 */

// Import PDF.js library and configure worker
import * as pdfjsLib from "./pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

// DOM element references
const checkPlagiarismButton = document.getElementById("checkplagiarism");
const outputDiv = document.getElementById("output1");
const output = document.getElementById("output2");
const resultOutput = document.getElementById("output3");
const fileInput1 = document.getElementById("fileInput1");
const fileInput2 = document.getElementById("fileInput2");
const uploadArea1 = document.getElementById("uploadArea1");
const uploadArea2 = document.getElementById("uploadArea2");

// Global state variables for storing dropped files
let droppedPdfFiles = [];
let droppedDocxFile = null;

/**
 * Prevents default drag and drop behavior
 * @param {Event} e - The drag event
 */
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Add event listeners for all drag and drop events
["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  uploadArea1.addEventListener(eventName, preventDefaults);
  uploadArea2.addEventListener(eventName, preventDefaults);
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
const handleFiles = debounce((files, previewElementId) => {
  const preview = document.getElementById(previewElementId);
  if (!preview) {
    console.error(`Element with ID ${previewElementId} not found.`);
    return;
  }
  // Clear existing preview content
  preview.innerHTML = "";

  // Generate preview for each file
  for (const file of files) {
    const fileItem = document.createElement("p");
    // Display file name and size in KB
    fileItem.textContent = `File: ${file.name} (${(file.size / 1024).toFixed(
      2
    )} KB)`;
    preview.appendChild(fileItem);
  }
}, 500);

/**
 * Initialize drag and drop event handlers when DOM is loaded
 */
document.addEventListener("DOMContentLoaded", () => {
  const uploadArea1 = document.getElementById("uploadArea1");
  const uploadArea2 = document.getElementById("uploadArea2");

  /**
   * Handles dragover event
   * @param {DragEvent} event - The drag event
   */
  const handleDragOver = (event) => {
    event.preventDefault();
    event.currentTarget.classList.add("dragover");
  };

  /**
   * Handles dragleave event
   * @param {DragEvent} event - The drag event
   */
  const handleDragLeave = (event) => {
    event.currentTarget.classList.remove("dragover");
  };

  /**
   * Handles file drop event
   * @param {DragEvent} event - The drop event
   */
  const handleDrop = (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove("dragover");
    event.currentTarget.classList.remove("dragging");

    // Handle file drops based on upload area
    if (event.currentTarget.id === "uploadArea1") {
      droppedPdfFiles = Array.from(event.dataTransfer.files).filter(
        (file) => file.type === "application/pdf"
      );
      handleFiles(droppedPdfFiles, "preview1");
    } else if (event.currentTarget.id === "uploadArea2") {
      droppedDocxFile = Array.from(event.dataTransfer.files).find((file) =>
        file.name.endsWith(".docx")
      );
      handleFiles([droppedDocxFile].filter(Boolean), "preview2");
    }
  };

  // Add event listeners to upload areas
  uploadArea1.addEventListener("dragover", handleDragOver);
  uploadArea1.addEventListener("dragleave", handleDragLeave);
  uploadArea1.addEventListener("drop", handleDrop);

  uploadArea2.addEventListener("dragover", handleDragOver);
  uploadArea2.addEventListener("dragleave", handleDragLeave);
  uploadArea2.addEventListener("drop", handleDrop);

  // File input event handlers for manual file selection
  fileInput1.addEventListener("change", (event) => {
    handleFiles(event.target.files, "preview1");
  });

  fileInput2.addEventListener("change", (event) => {
    handleFiles(event.target.files, "preview2");
  });

  /**
   * Handle plagiarism check button click
   * Initiates text extraction and comparison process
   */
  checkPlagiarismButton.addEventListener("click", async () => {
    try {
      // Show loading state
      outputDiv.textContent = "Processing files...";

      // Start extraction process
      await handleExtractButtonClick();
    } catch (error) {
      // Display any errors that occur
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
async function handleExtractButtonClick() {
  const pdfFiles = getPdfFiles();
  const docxFile = getDocxFile();

  // Validate file selections
  validateFiles(pdfFiles, docxFile);

  // Merge and sort files by timestamp
  const finalPdfFiles = mergePdfFiles(pdfFiles);
  const finalDocx = getFinalDocxFile(docxFile);

  // Process files and extract text
  await extractTextFromMultiplePDFs(finalPdfFiles, finalDocx);
}

/**
 * Retrieves PDF files from file input
 * @returns {File[]} Array of PDF files
 */
function getPdfFiles() {
  return Array.from(fileInput1.files);
}

/**
 * Retrieves DOCX file from file input
 * @returns {File|null} The DOCX file or null
 */
function getDocxFile() {
  return fileInput2.files[0];
}

/**
 * Validates that required files are present
 * @param {File[]} pdfFiles - Array of PDF files
 * @param {File} docxFile - DOCX file
 * @throws {Error} If required files are missing
 */
function validateFiles(pdfFiles, docxFile) {
  // Check for at least one PDF file
  if (!droppedPdfFiles.length && !pdfFiles.length) {
    throw new Error("Please upload at least one PDF file.");
  }

  // Check for DOCX file
  if (!docxFile && !droppedDocxFile) {
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
 * Gets the final DOCX file by comparing timestamps of uploaded and dropped files
 * @param {File} docxFile - The uploaded DOCX file
 * @returns {File} The most recently modified DOCX file
 */
function getFinalDocxFile(docxFile) {
  // Compare timestamps and return the most recent file
  return docxFile && droppedDocxFile
    ? docxFile.lastModified > droppedDocxFile.lastModified
      ? docxFile
      : droppedDocxFile
    : docxFile || droppedDocxFile;
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
async function extractTextFromMultiplePDFs(pdfFiles, docxFile) {
  let cleanedClientInput;

  try {
    // Process DOCX file if valid
    if (docxFile && docxFile.name.endsWith(".docx")) {
      const arrayBuffer = await docxFile.arrayBuffer();
      // Extract raw text using mammoth
      const result = await mammoth.extractRawText({ arrayBuffer });
      // Clean and standardize the text
      cleanedClientInput = cleanWord(result.value);
      // Display processed text
      output.innerHTML = `<p>${cleanedClientInput}</p>`;
    }

    // Validate text extraction
    if (!cleanedClientInput) {
      throw new Error("No text could be extracted from the DOCX file");
    }

    // Split input text into array for comparison
    let arrayClientInput = cleanedClientInput.split(" ");
    let copyClientInput01 = [...arrayClientInput];
    let allResults = "";

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
        const cleaned_text = cleanWord(text);
        let arrayCompareInput = cleaned_text.split(" ");

        // Compare texts and find common elements
        findCommonElements(
          arrayClientInput,
          arrayCompareInput,
          copyClientInput01
        );

        // Format results for display
        return `File: ${file.name}\n\n${cleaned_text}\n\n------------------------\n\n`;
      } catch (error) {
        return `Error processing ${file.name}: ${error.message}\n\n`;
      }
    });

    // Wait for all PDF processing to complete
    const pdfResults = await Promise.allSettled(pdfExtractionPromises);

    // Filter and combine successful results
    const fulfilledResults = pdfResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    // Combine and display results
    allResults = fulfilledResults.join("");

    // Format highlighted text for display
    let highlightedTextString = copyClientInput01.join(" ");
    resultOutput.innerHTML = highlightedTextString;
    outputDiv.textContent = allResults || "No text extracted from PDFs.";
  } catch (error) {
    throw new Error(`Processing error: ${error.message}`);
  }
}

/**
 * Finds and highlights common elements between input texts
 * @param {string[]} arrayClientInput - Original input text array
 * @param {string[]} arrayCompareInput - Text to compare against
 * @param {string[]} copyClientInput01 - Copy of input for highlighting
 */
function findCommonElements(
  arrayClientInput,
  arrayCompareInput,
  copyClientInput01
) {
  // Create Set for efficient word lookup
  const compareSet = new Set(arrayCompareInput);
  const sizeOfClientInput = arrayClientInput.length;

  // Check for matching sequences of 13 words
  for (let i = 0; i <= sizeOfClientInput - 13; i++) {
    const compareClient = arrayClientInput.slice(i, i + 13);

    // If all words in sequence match, highlight them
    if (compareClient.every((word) => compareSet.has(word))) {
      const colorCommonElement = compareClient.map(
        (common) => `<span style="color:red">${common}</span>`
      );
      copyClientInput01.splice(i, 13, ...colorCommonElement);
    }
  }
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
      // Remove diacritics and non-alphanumeric chars
      .replace(/[\u0300-\u036f]|[^a-zA-Z0-9 ]|\s+/g, " ")
      // Remove leading/trailing whitespace
      .trim()
      // Convert to lowercase for case-insensitive comparison
      .toLowerCase()
  );
}
