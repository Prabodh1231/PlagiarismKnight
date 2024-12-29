/**
 * This script handles the drag-and-drop functionality for PDF and DOCX files,
 * extracts text from the files, and compares the text for plagiarism detection.
 */

import * as pdfjsLib from "./pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

const checkPlagiarismButton = document.getElementById("checkplagrism");
const outputDiv = document.getElementById("output1");
const output = document.getElementById("output2");
const resultOutput = document.getElementById("output3");
const fileInput1 = document.getElementById("fileInput1");
const fileInput2 = document.getElementById("fileInput2");
const uploadArea1 = document.getElementById("uploadArea1");
const uploadArea2 = document.getElementById("uploadArea2");

let droppedPdfFiles = [];
let droppedDocxFile = null;

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  uploadArea1.addEventListener(eventName, preventDefaults);
  uploadArea2.addEventListener(eventName, preventDefaults);
});

const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

const handleFiles = debounce((files, previewElementId) => {
  const preview = document.getElementById(previewElementId);
  if (!preview) {
    console.error(`Element with ID ${previewElementId} not found.`);
    return;
  }
  preview.innerHTML = "";

  for (const file of files) {
    const fileItem = document.createElement("p");
    fileItem.textContent = `File: ${file.name} (${(file.size / 1024).toFixed(
      2
    )} KB)`;
    preview.appendChild(fileItem);
  }
}, 500);

const uploadAreas = document.querySelectorAll(".upload-area");
uploadAreas.forEach((uploadArea) => {
  uploadArea.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadArea.classList.add("dragging");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragging");
  });

  uploadArea.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadArea.classList.remove("dragging");

    if (uploadArea.id === "uploadArea1") {
      droppedPdfFiles = Array.from(event.dataTransfer.files).filter(
        (file) => file.type === "application/pdf"
      );
      handleFiles(droppedPdfFiles, "preview1");
    } else if (uploadArea.id === "uploadArea2") {
      droppedDocxFile = Array.from(event.dataTransfer.files).find((file) =>
        file.name.endsWith(".docx")
      );
      handleFiles([droppedDocxFile].filter(Boolean), "preview2");
    }
  });
});

fileInput1.addEventListener("change", (event) => {
  handleFiles(event.target.files, "preview1");
});

fileInput2.addEventListener("change", (event) => {
  handleFiles(event.target.files, "preview2");
});

checkPlagiarismButton.addEventListener("click", async () => {
  try {
    await handleExtractButtonClick();
  } catch (error) {
    outputDiv.textContent = `Error: ${error.message}`;
  }
});

async function handleExtractButtonClick() {
  const pdfFiles = getPdfFiles();
  const docxFile = getDocxFile();

  validateFiles(pdfFiles, docxFile);

  const finalPdfFiles = mergePdfFiles(pdfFiles);
  const finalDocx = getFinalDocxFile(docxFile);

  await extractTextFromMultiplePDFs(finalPdfFiles, finalDocx);
}

function getPdfFiles() {
  return Array.from(fileInput1.files);
}

function getDocxFile() {
  return fileInput2.files[0];
}

function validateFiles(pdfFiles, docxFile) {
  if (!droppedPdfFiles.length && !pdfFiles.length) {
    throw new Error("Please upload at least one PDF file.");
  }

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

function getFinalDocxFile(docxFile) {
  return docxFile && droppedDocxFile
    ? docxFile.lastModified > droppedDocxFile.lastModified
      ? docxFile
      : droppedDocxFile
    : docxFile || droppedDocxFile;
}

async function extractTextFromMultiplePDFs(pdfFiles, docxFile) {
  let cleanedClientInput;

  try {
    if (docxFile && docxFile.name.endsWith(".docx")) {
      const arrayBuffer = await docxFile.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      cleanedClientInput = cleanWord(result.value);
      output.innerHTML = `<p>${cleanedClientInput}</p>`;
    }

    if (!cleanedClientInput) {
      throw new Error("No valid DOCX file content to process.");
    }

    let arrayClientInput = cleanedClientInput.split(" ");
    let copyClientInput01 = [...arrayClientInput];
    let allResults = "";

    outputDiv.textContent = "Processing PDFs...";

    const pdfExtractionPromises = pdfFiles.map(async (file) => {
      try {
        const text = await extractTextFromPDF(file);
        const cleaned_text = cleanWord(text);
        let arrayCompareInput = cleaned_text.split(" ");

        findCommonElements(
          arrayClientInput,
          arrayCompareInput,
          copyClientInput01
        );
        return `File: ${file.name}\n\n${cleaned_text}\n\n------------------------\n\n`;
      } catch (error) {
        return `Error processing ${file.name}: ${error.message}\n\n`;
      }
    });
    const pdfResults = await Promise.allSettled(pdfExtractionPromises);
    const fulfilledResults = pdfResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    allResults = fulfilledResults.join("");

    let highlightedTextString = copyClientInput01.join(" ");
    resultOutput.innerHTML = highlightedTextString;
    outputDiv.textContent = allResults || "No text extracted from PDFs.";
  } catch (error) {
    throw new Error(`Processing error: ${error.message}`);
  }
}

function findCommonElements(
  arrayClientInput,
  arrayCompareInput,
  copyClientInput01
) {
  const compareSet = new Set(arrayCompareInput);
  const sizeOfClientInput = arrayClientInput.length;

  for (let i = 0; i <= sizeOfClientInput - 13; i++) {
    const compareClient = arrayClientInput.slice(i, i + 13);

    if (compareClient.every((word) => compareSet.has(word))) {
      const colorCommonElement = compareClient.map(
        (common) => `<span style="color:red">${common}</span>`
      );
      copyClientInput01.splice(i, 13, ...colorCommonElement);
    }
  }
}

async function extractTextFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
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

function cleanWord(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]|[^a-zA-Z0-9 ]|\s+/g, " ")
    .trim()
    .toLowerCase();
}
