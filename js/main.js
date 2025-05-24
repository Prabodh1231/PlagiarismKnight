/**
 * This script handles the drag-and-drop functionality for PDF and DOCX files,
 * extracts text from the files, and compares the text for plagiarism detection.
 * @author [Prabodh Singh]
 * @version 1.0.1
 */

// DOM element references
const checkPlagiarismButton = document.getElementById("checkplagiarism");
const resultOutput = document.getElementById("output");
const fileInputPdf = document.getElementById("fileInput1");
const fileInputDocx = document.getElementById("fileInput2");
const uploadAreaPdf = document.getElementById("uploadAreaPdf");
const uploadAreaDocx = document.getElementById("uploadAreaDocx");
const previewPdf = document.getElementById("preview1");
const previewDocx = document.getElementById("preview2");
const processingDialog = document.getElementById("processing-dialog");
const progressBar = document.getElementById("progress-bar");
const currentfile = document.getElementById("currentfile");

// Global state variables for storing dropped files - Consider using a single object to manage file state
const uploadedFiles = {
  pdfFiles: new Map(), // Using Map instead of Set for more control
  docxFile: null,
};

const getFileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;

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
    console.error(`Preview element not found.`);
    return;
  }

  // Clear previous preview content
  previewElement.innerHTML = "";

  if (!files || files.length === 0) return;

  const fragment = document.createDocumentFragment(); // Create preview table for better organization

  const table = document.createElement("table");
  table.className = "file-preview-table"; // Add table header

  const header = document.createElement("tr");
  header.innerHTML = "<th>File Name</th><th>Size</th>";
  table.appendChild(header); // Add file rows

  for (const file of files) {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = file.name;
    nameCell.classList.add("word-wrap");

    const sizeCell = document.createElement("td");
    const sizeKB = (file.size / 1024).toFixed(2);
    sizeCell.textContent = `${sizeKB} KB`;

    row.appendChild(nameCell);
    row.appendChild(sizeCell);

    table.appendChild(row);
  }

  fragment.appendChild(table);
  previewElement.appendChild(fragment);
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
      const newPdfFiles = files.filter(
        (file) => file.type === "application/pdf"
      );
      // Add new files to the Map
      newPdfFiles.forEach((file) => {
        uploadedFiles.pdfFiles.set(getFileKey(file), file);
      });

      // Convert Map values to Array for the preview function
      handleFilePreview(
        Array.from(uploadedFiles.pdfFiles.values()),
        previewPdf
      );
    } else if (uploadAreaId === "uploadAreaDocx") {
      uploadedFiles.docxFile =
        files.find((file) => file.name.endsWith(".docx")) || null; // Ensure null if no docx
      handleFilePreview([uploadedFiles.docxFile].filter(Boolean), previewDocx); // Handle null docxFile correctly
    }
  };

  // Add event listeners to upload areas -  More efficient to loop and bind once
  [uploadAreaPdf, uploadAreaDocx].forEach((uploadArea) => {
    uploadArea.addEventListener("dragover", handleDragOver);
    uploadArea.addEventListener("dragleave", handleDragLeave);
    uploadArea.addEventListener("drop", handleDrop);
  });

  // File input event handlers for manual file selection - Directly use handleFilePreview
  fileInputPdf.addEventListener("change", (event) => {
    // Add new files to the Map using a composite key
    Array.from(event.target.files).forEach((file) => {
      if (file.type === "application/pdf") {
        uploadedFiles.pdfFiles.set(getFileKey(file), file);
      }
    });

    handleFilePreview(Array.from(uploadedFiles.pdfFiles.values()), previewPdf);
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
      await handleExtractAndCompare(); // Renamed function for clarity
    } catch (error) {
      console.error("Plagiarism check failed:", error);
    }
  });
});

/**
 * Main handler for text extraction process - Enhanced with better error handling
 * @returns {Promise<void>}
 */
async function handleExtractAndCompare() {
  const pdfFiles = Array.from(uploadedFiles.pdfFiles.values());
  const docxFile = uploadedFiles.docxFile;

  try {
    // Validate files upfront with proper error display
    if (!pdfFiles.length) {
      resultOutput.innerHTML =
        '<div class="error">Please upload at least one PDF file.</div>';
      return;
    }
    if (!docxFile) {
      resultOutput.innerHTML =
        '<div class="error">Please upload a .docx file.</div>';
      return;
    }

    processingDialog.showModal(); // Show dialog before processing
    progressBar.value = 0;

    await extractTextAndCompare(pdfFiles, docxFile);
  } catch (error) {
    resultOutput.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    console.error("Extraction failed:", error);
  } finally {
    processingDialog.close(); // Ensure dialog is closed even if error occurs
  }
}

/**
 * Generates an HTML summary report of the plagiarism check.
 * @param {Array<object>} results - The plagiarism check results.
 * @param {Array<File>} pdfFiles - The list of PDF files checked.
 * @param {File} docxFile - The DOCX file checked.
 * @returns {string} - HTML string for the summary report.
 */
function generateSummaryReportHTML(results, pdfFiles, docxFile, docxlength) {
  const highlightedSectionsCount = results.length;
  const pdfFileNames = pdfFiles.map((file) => file.name).join(", ");
  const docxFileName = docxFile ? docxFile.name : "N/A";
  const idSet = new Set();
  let plagiarizedWordCount = 0;

  results.forEach((item) => {
    item.Ids.forEach((id) => {
      idSet.add(id);
    });
  });

  plagiarizedWordCount = idSet.size;
  const plagiarismPercentage = parseFloat(
    ((plagiarizedWordCount / docxlength) * 100).toFixed(2)
  );

  let plagiarismLevelText = "";
  let plagiarismColor = "";

  if (plagiarismPercentage < 10) {
    plagiarismLevelText = "Low Plagiarism";
    plagiarismColor = "green";
  } else if (plagiarismPercentage < 25) {
    plagiarismLevelText = "Moderate Plagiarism";
    plagiarismColor = "orange";
  } else {
    plagiarismLevelText = "High Plagiarism";
    plagiarismColor = "red";
  }

  let summaryHTML = `
  <h1 class="brand-name">Plagiarism<span>Knight</span></h1>
  
      <div class="summary-report">
        <h2>Plagiarism Check Summary</h2>
        <p><strong>DOCX File:</strong> ${docxFileName}</p>
        <p><strong>PDF Files:</strong> ${pdfFileNames}</p>
        <p><strong>Highlighted Sections Detected:</strong> ${highlightedSectionsCount}</p>
        <div class="plagiarism-percentage" style="color: ${plagiarismColor}; font-size: 1.2em; font-weight: bold; margin-top: 10px;">
          Plagiarism Level: <span style="display: inline-block; padding: 5px 10px; background-color: #f0f0f0; border-radius: 5px;">${plagiarismLevelText} (${plagiarismPercentage}%)</span>
        </div>
        <hr/>
        <h3>Detailed Highlighted Text:</h3>
      </div>
    `;

  let pdfSummary = results.map((item) => {
    let pdfName = item.file;
    let pdfColor = item.color.hex;
    let colorname = item.color.name;

    let pdfPercentage = parseFloat(
      ((item.Ids.length / docxlength) * 100).toFixed(2)
    );

    return {
      name: pdfName,
      color: pdfColor,
      colorname: colorname,
      percentage: pdfPercentage,
    };
  });

  function createTable(data) {
    let tableHTML = '<table border="1" cellpadding="10">';

    // Table header
    tableHTML += "<tr><th>PDF Name</th><th>Color</th><th>Percentage</th></tr>";

    // Table rows
    data.forEach((row) => {
      tableHTML += `<tr>
            <td>${row.name}</td>
            <td style="background-color:${row.color}">${row.colorname}</td>
            <td>${row.percentage}%</td>
        </tr>`;
    });

    tableHTML += "</table> <br> <hr/> <br>";

    return tableHTML;
  }

  summaryHTML += createTable(pdfSummary);
  return summaryHTML;
}

/**
 * Extracts text from multiple PDF files and compares it with the text extracted from a DOCX file.
 * Updated to properly handle worker communication.
 */
async function extractTextAndCompare(pdfFiles, docxFile) {
  console.time("Bear");
  try {
    resultOutput.innerHTML =
      '<div class="processing">Processing files...</div>';

    let docxText = await extractDocxText(docxFile);
    let docxArray = separateWordsAndTags(convertToObjects(docxText));

    // Clone the docx array to avoid mutating the original
    let docxTextWord = JSON.parse(JSON.stringify(docxArray.words));
    docxTextWord = cleanDocxTextWord(docxTextWord);

    let docxlength = docxTextWord.length;

    // Create rolling windows from the DOCX content for comparison
    let rollingWindows = createRollingWindows(docxTextWord, 13);

    let docx_obj_no_stopwords = removeStopWords(docxTextWord);

    let docx_trigrams = generateStructuredTrigrams(docx_obj_no_stopwords);

    const maxWorkers = 4;
    const workers = [];
    const results = [];
    let filesProcessed = 0;
    const totalFiles = pdfFiles.length;
    let batchSize = 2; // Each worker will process 2 files at once
    let fileIndex = 0;

    let colorIndex = 0; // Initialize color index

    const processFilePair = async (pdfFilePair) => {
      return new Promise(async (resolve, reject) => {
        const worker = new Worker(
          new URL("./main.worker.js", import.meta.url),
          {
            type: "module",
          }
        );

        workers.push(worker);

        worker.onmessage = (event) => {
          try {
            if (event.data.type === "progress") {
              filesProcessed += event.data.filesCompleted || 1;
              progressBar.value = (filesProcessed / totalFiles) * 100;
              currentfile.innerHTML =
                event.data.file + "  VS  " + docxFile.name;
            } else if (event.data.type === "result") {
              results.push(...event.data.results); // Spread the results as they may contain multiple file results
              workers.splice(workers.indexOf(worker), 1);
              worker.terminate();
              resolve(event.data.results);
            } else if (event.data.type === "error") {
              console.error("Worker reported error:", event.data.message);
              reject(new Error(event.data.message));
              workers.splice(workers.indexOf(worker), 1);
              worker.terminate();
            }
          } catch (error) {
            console.error("Error in worker message handler:", error);
            reject(error);
            workers.splice(workers.indexOf(worker), 1);
            worker.terminate();
          }
        };

        worker.onerror = (error) => {
          console.error("Worker error event:", error);
          reject(new Error(`Worker error: ${error.message}`));
          workers.splice(workers.indexOf(worker), 1);
          worker.terminate();
        };

        try {
          const pdfBuffers = [];
          const transferBuffers = [];

          for (const pdfFile of pdfFilePair) {
            if (!pdfFile) continue;

            const pdfBuffer = await pdfFile.arrayBuffer();
            pdfBuffers.push({
              name: pdfFile.name,
              type: pdfFile.type,
              size: pdfFile.size,
              lastModified: pdfFile.lastModified,
              arrayBuffer: pdfBuffer,
            });
            transferBuffers.push(pdfBuffer);
          }

          const color1 = colors[colorIndex % colors.length];
          const color2 = colors[(colorIndex + 1) % colors.length];
          colorIndex += 2;

          worker.postMessage(
            {
              pdfBuffers: pdfBuffers,
              rollingWindows: rollingWindows,
              docx_trigrams: {
                trigrams: docx_trigrams.trigrams,
                uniqueTrigramTexts: Array.from(
                  docx_trigrams.uniqueTrigramTexts
                ),
              },
              colors: [color1, color2],
              action: "process",
            },
            transferBuffers // Pass transferBuffers as second argument for better performance
          );
        } catch (error) {
          reject(new Error(`Failed to read PDF file(s): ${error.message}`));
          workers.splice(workers.indexOf(worker), 1);
          worker.terminate();
        }
      });
    };

    const processBatch = async () => {
      // Create pairs of PDF files
      const pairs = [];
      for (
        let i = fileIndex;
        i < Math.min(fileIndex + maxWorkers * batchSize, totalFiles);
        i += batchSize
      ) {
        const pair = pdfFiles.slice(i, Math.min(i + batchSize, totalFiles));
        pairs.push(pair);
      }

      const promises = pairs.map((pair) => processFilePair(pair));
      return Promise.all(promises);
    };

    const processAllFiles = async () => {
      while (fileIndex < totalFiles) {
        await processBatch();
        fileIndex += maxWorkers * batchSize;

        // Limit the number of active workers
        while (workers.length >= maxWorkers) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // Wait briefly
        }
      }
    };

    await processAllFiles();

    const allResults = results.flat();

    if (totalFiles > 15) {
      const trigramFrequency = findUniqueTrigrams(allResults);

      const IdsoftopTrigrams = getWordIdsForDistinctiveTrigrams(
        trigramFrequency,
        docx_trigrams
      );

      const finalresults = updateDocumentIdsWithDistinctiveTrigrams(
        allResults,
        IdsoftopTrigrams
      );

      docxArray.words = addSpanTagsAndModify(docxArray.words, finalresults);

      let highlightedTextHTML = combineWordsAndTagsInOrder(docxArray);
      const summaryReportHTML = generateSummaryReportHTML(
        finalresults,
        pdfFiles,
        docxFile,
        docxlength
      );
      addSavePdfButtonDynamically();
      resultOutput.innerHTML = summaryReportHTML + highlightedTextHTML;

      console.timeEnd("Bear");
    } else {
      docxArray.words = addSpanTagsAndModify(docxArray.words, allResults);

      let highlightedTextHTML = combineWordsAndTagsInOrder(docxArray);
      const summaryReportHTML = generateSummaryReportHTML(
        allResults,
        pdfFiles,
        docxFile,
        docxlength
      );
      addSavePdfButtonDynamically();
      resultOutput.innerHTML = summaryReportHTML + highlightedTextHTML;
      console.timeEnd("Bear");
    }
  } catch (error) {
    throw new Error(`Text extraction failed: ${error.message}`);
  }
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
          // const tagMatch = tagContent.match(/^<\/?([a-zA-Z0-9]+)/);

          const tagObject = {
            id: id++,
            type: "tag",
            content: tagContent,
            // tagName: tagMatch[1],
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
      });
    } else if (item.type === "tag") {
      tags.push({ id: item.id, content: item.content });
    }
  });

  return { words, tags };
}

/**
 * Finds the most unique trigrams based on IDF scores, including all trigrams that tie for top scores
 *
 * @param {Array<{Ids: string[], alikeTrigramTexts: string[], file: string, color: string}>} dataArray
 * An array of objects, where each object contains:
 * - Ids: An array of document IDs.
 * - alikeTrigramTexts: An array of ALL trigram texts in the document.
 * - file: The file name.
 * - color: A color.
 * @returns {Array<{trigram: string, idfScore: number, documentCount: number}>}
 * An array of the unique trigrams
 */
function findUniqueTrigrams(dataArray) {
  // 1. Input Validation
  if (!Array.isArray(dataArray)) {
    console.error("Invalid input. dataArray must be an array.");
    return [];
  }

  // 2. Calculate Document Frequency (DF)
  const trigramDocumentFrequency = new Map(); // Map to store DF: trigram -> count

  // Map to track which documents contain each trigram
  const trigramToDocumentMap = new Map();

  // Process each document
  for (let docIndex = 0; docIndex < dataArray.length; docIndex++) {
    const item = dataArray[docIndex];
    if (Array.isArray(item.alikeTrigramTexts)) {
      const uniqueTrigrams = new Set(item.alikeTrigramTexts); // Count each trigram *once* per document

      // Update document frequency counts and document mapping
      for (const trigram of uniqueTrigrams) {
        // Update document frequency
        trigramDocumentFrequency.set(
          trigram,
          (trigramDocumentFrequency.get(trigram) || 0) + 1
        );

        // Track which document contains this trigram
        if (!trigramToDocumentMap.has(trigram)) {
          trigramToDocumentMap.set(trigram, []);
        }
        trigramToDocumentMap.get(trigram).push(docIndex);
      }
    }
  }

  // 3. Find trigrams that appear in exactly one document
  const uniqueTrigrams = [];
  for (const [trigram, count] of trigramDocumentFrequency.entries()) {
    if (count === 1) {
      const documentIndex = trigramToDocumentMap.get(trigram)[0];
      uniqueTrigrams.push({
        trigram,
        documentIndex,
        documentCount: 1,
      });
    }
  }

  // 4. Sort alphabetically by trigram for easier reading (optional)
  uniqueTrigrams.sort((a, b) => a.trigram.localeCompare(b.trigram));

  return uniqueTrigrams;
}
/**
 * Finds the wordIds corresponding to the distinctive trigrams we identified
 *
 * @param {Array<{trigram: string, idfScore: number, documentCount: number}>} distinctiveTrigrams
 * The array of distinctive trigrams returned by findMostDistinctiveTrigrams
 *
 * @param {{trigrams: Object, uniqueTrigramTexts: Array<string>}} trigramData
 * Object containing:
 * - trigrams: Dictionary where keys are trigramKeys and values are objects with readableText and wordIds
 * - uniqueTrigramTexts: Array of unique trigram texts
 *
 * @returns {Array<{trigram: string, idfScore: number, documentCount: number, wordIds: Array<string>, readableText: string}>}
 * The original distinctive trigrams with wordIds and readableText added
 */
function getWordIdsForDistinctiveTrigrams(distinctiveTrigrams, trigramData) {
  // Input validation
  if (
    !Array.isArray(distinctiveTrigrams) ||
    !trigramData ||
    !trigramData.trigrams
  ) {
    console.error("Invalid input parameters");
    return [];
  }

  const { trigrams: trigramDictionary } = trigramData;
  const result = [];

  // For each distinctive trigram
  for (const distinctiveTrigram of distinctiveTrigrams) {
    const { trigram, idfScore, documentCount } = distinctiveTrigram;

    // Find the matching trigram in the dictionary
    // We need to search through the dictionary as we don't know the key directly
    let found = false;

    for (const trigramKey in trigramDictionary) {
      const trigramEntry = trigramDictionary[trigramKey];

      // Compare trigram text with the readableText in the dictionary
      if (trigramEntry.readableText === trigram) {
        // Match found, add wordIds and readableText to our result
        result.push({
          trigram,
          idfScore,
          documentCount,
          wordIds: trigramEntry.wordIds,
          readableText: trigramEntry.readableText,
        });
        found = true;
        break;
      }
    }

    // If no match was found in the dictionary
    if (!found) {
      console.warn(`No matching entry found for trigram: ${trigram}`);
      // Still include the trigram in results, but with empty wordIds
      result.push({
        ...distinctiveTrigram,
        wordIds: [],
        readableText: trigram,
      });
    }
  }

  return result;
}

/**
 * Updates the Ids array of each document in dataArray if it contains any of the distinctive trigrams
 *
 * @param {Array<{Ids: string[], alikeTrigramTexts: string[], file: string, color: string}>} dataArray
 * The original array of document objects
 *
 * @param {Array<{trigram: string, idfScore: number, documentCount: number, wordIds: Array<string>}>} distinctiveTrigramsWithIds
 * The array of distinctive trigrams with their wordIds
 *
 * @returns {Array<{Ids: string[], alikeTrigramTexts: string[], file: string, color: string}>}
 * A new array with updated Ids for documents containing distinctive trigrams
 */
function updateDocumentIdsWithDistinctiveTrigrams(
  dataArray,
  distinctiveTrigramsWithIds
) {
  // Input validation
  if (!Array.isArray(dataArray) || !Array.isArray(distinctiveTrigramsWithIds)) {
    console.error("Invalid input parameters");
    return [];
  }

  // Create a new array to avoid mutating the original
  return dataArray.map((document) => {
    // Create a shallow copy of the document
    const updatedDocument = { ...document };

    // If document doesn't have alikeTrigramTexts, return it unchanged
    if (!Array.isArray(document.alikeTrigramTexts)) {
      return updatedDocument;
    }

    // Create a set of the document's existing IDs for efficient lookups
    const existingIds = new Set(document.Ids || []);
    // Array to collect new IDs
    const newIds = [];

    // For each distinctive trigram
    for (const distinctiveTrigram of distinctiveTrigramsWithIds) {
      const { trigram, wordIds } = distinctiveTrigram;

      // If this trigram exists in the document's alikeTrigramTexts
      if (document.alikeTrigramTexts.includes(trigram)) {
        // Add all wordIds from this trigram that aren't already in the document's Ids
        for (const wordId of wordIds) {
          if (!existingIds.has(wordId)) {
            newIds.push(wordId);
            existingIds.add(wordId); // Prevent duplicates within newly added IDs
          }
        }
      }
    }

    // Only update the Ids if we found new ones to add
    if (newIds.length > 0) {
      updatedDocument.Ids = [...(document.Ids || []), ...newIds];
    }

    return updatedDocument;
  });
}

function addSpanTagsAndModify(array, allResults) {
  return array.map((item) => {
    // Check if any result's Ids contain this item's id
    const matchingResult = allResults.find(
      (result) => result.Ids.includes(item.id) && !item.modified
    );

    if (matchingResult) {
      // Wrap the content in a span tag with the color from the matching result
      const modifiedContent = `<span title="${matchingResult.file}" style="background-color: ${matchingResult.color.hex}">${item.content}</span>`;
      return {
        ...item,
        content: modifiedContent,
        modified: true,
      };
    }
    return item; // Return the item unchanged if no matching result or already modified
  });
}

function combineWordsAndTagsInOrder(data) {
  // Combine words and tags into a single array
  const combined = [...data.words, ...data.tags]; // Sort by id

  combined.sort((a, b) => a.id - b.id); // Initialize result array

  let result = [];

  for (let i = 0; i < combined.length; i++) {
    const currentItem = combined[i];
    const nextItem = combined[i + 1]; // Add the current item's content

    result.push(currentItem.content); // Add space if: // 1. This is not the last item // 3. Next item is also a word // 4. Current item's content is not a single character (like '/')

    if (nextItem) {
      result.push(" ");
    }
  } // Join the final array

  return result.join("");
}

const colors = [
  { name: "Seafoam", hex: "#71EEB8AA" },
  { name: "Powder Blue", hex: "#B0E0E6AA" },
  { name: "Lavender", hex: "#E6E6FAAA" },
  { name: "Tangerine", hex: "#F28500AA" },
  { name: "Mint Green", hex: "#98FB98AA" },
  { name: "Baby Blue", hex: "#89CFFAAA" },
  { name: "Light Pink", hex: "#FFB6C1AA" },
  { name: "Light Teal", hex: "#8FDBDCAA" },
  { name: "Azure", hex: "#F0FFFFAA" },
  { name: "Orchid", hex: "#DA70D6AA" },
  { name: "Champagne", hex: "#F7E7CEAA" },
  { name: "Coral", hex: "#FF7F50AA" },
  { name: "Pale Yellow", hex: "#FFFF99AA" },
  { name: "Neon Yellow", hex: "#DFFF00AA" },
  { name: "Sky Blue", hex: "#87CEEBAA" },
  { name: "Ecru", hex: "#CCC5A3AA" },
  { name: "Light Green", hex: "#90EE90AA" },
  { name: "Peach", hex: "#FFDAB9AA" },
  { name: "Light Lime", hex: "#CCFF00AA" },
  { name: "Pale Teal", hex: "#80CBC4AA" },
  { name: "Spring Green", hex: "#00FF7FAA" },
  { name: "Magenta", hex: "#FF00FFAA" },
  { name: "Light Orange", hex: "#FFA500AA" },
  { name: "Mauve", hex: "#E0B0FFAA" },
  { name: "Fuchsia", hex: "#FF77FFAA" },
  { name: "Thistle", hex: "#D8BFD8AA" },
  { name: "Salmon", hex: "#FFA07AAA" },
  { name: "Chartreuse", hex: "#DFFF4FAA" },
  { name: "Light Red", hex: "#FFCCCCAA" },
  { name: "Canary", hex: "#FFEF00AA" },
  { name: "Yellow", hex: "#FFFF00AA" },
  { name: "Lime", hex: "#BFFF00AA" },
  { name: "Periwinkle", hex: "#CCCCFFAA" },
  { name: "Pale Green", hex: "#98FB98AA" },
  { name: "Bubblegum", hex: "#FFC1CCAA" },
  { name: "Ivory", hex: "#FFFFF0AA" },
  { name: "Violet", hex: "#EE82EEAA" },
  { name: "Apricot", hex: "#FBCEB1AA" },
  { name: "Melon", hex: "#FDBCB4AA" },
  { name: "Turquoise", hex: "#40E0D0AA" },
  { name: "Rose", hex: "#FF007FAA" },
  { name: "Pale Yellow", hex: "#FFFACDAA" },
  { name: "Light Purple", hex: "#D8BFD8AA" },
  { name: "Amethyst", hex: "#9966CCAA" },
  { name: "Cornflower Blue", hex: "#6495EDAA" },
];

function cleanDocxTextWord(wordsArray) {
  // Clean each item in the array
  wordsArray.forEach((item) => {
    if (item.content) {
      const cleanedContent = cleanWord(item.content);
      item.content = cleanedContent;
    }
    delete item.modified; // Remove the 'modified' property if it exists
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
  return {
    trigrams: trigramDictionary,
    uniqueTrigramTexts: uniqueTrigramTexts,
  };
}

// Function to handle saving as PDF (your existing logic)
function saveAsPDF() {
  const originalTitle = document.title;
  document.title = "My Webpage - " + new Date().toLocaleDateString();

  window.print();

  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}

// Function to dynamically add the button using innerHTML/insertAdjacentHTML
function addSavePdfButtonDynamically() {
  // 1. Get the container where you want to add the button
  const container = document.getElementById("buttonContainer"); // Make sure you have a <div id="buttonContainer"> in your HTML

  if (container) {
    // 2. Define the HTML string for the button
    // It's good practice to give it an ID so you can easily select it later
    const buttonHtml =
      '<button class="save-btn" id="dynamicSavePdfButton">📄 Save as PDF</button>';

    // 3. Add the HTML string to the container
    // insertAdjacentHTML is often preferred over innerHTML if you want to
    // append/prepend without overwriting existing content.
    // 'beforeend' means inside the container, after its last child.
    container.insertAdjacentHTML("beforeend", buttonHtml);

    // 4. Get a reference to the newly added button
    // IMPORTANT: You must get the reference *after* it's been added to the DOM
    const dynamicButton = document.getElementById("dynamicSavePdfButton");

    // 5. Attach the event listener to the newly referenced button
    if (dynamicButton) {
      dynamicButton.addEventListener("click", saveAsPDF);
    } else {
      console.error(
        'Error: Dynamically added button with ID "dynamicSavePdfButton" not found.'
      );
    }
  } else {
    console.error('Error: "buttonContainer" element not found in HTML.');
  }
}

// Optional: Add keyboard shortcut (Ctrl+P or Cmd+P)
document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "p") {
    e.preventDefault();
    saveAsPDF();
  }
});
