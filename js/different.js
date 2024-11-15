import * as pdfjsLib from "./pdf.mjs";
import * as mammoth from "./mammoth.browser.js";

// Set the worker source to the local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

let extractButton = document.getElementById("checkplagrism");
extractButton.addEventListener("click", () => {
  // Get files from inputs when button is clicked
  const fileInput1 = document.getElementById("fileInput1");
  const fileInput2 = document.getElementById("fileInput2");
  const pdfFiles = Array.from(fileInput1.files);
  const docxFile = fileInput2.files[0];

  extractTextFromMultiplePDFs(pdfFiles, docxFile);
});

// Add drag-and-drop functionality for PDF and DOCX areas
document.getElementById("uploadArea1").addEventListener("drop", (event) => {
  event.preventDefault();
  const files = Array.from(event.dataTransfer.files).filter(
    (file) => file.type === "application/pdf"
  );
  extractTextFromMultiplePDFs(files, null); // Pass PDF files from drop area
});

document.getElementById("uploadArea2").addEventListener("drop", (event) => {
  event.preventDefault();
  const docxFile = Array.from(event.dataTransfer.files).find((file) =>
    file.name.endsWith(".docx")
  );
  extractTextFromMultiplePDFs([], docxFile); // Pass DOCX file from drop area
});

// Core function to handle text extraction
async function extractTextFromMultiplePDFs(pdfFiles, docxFile) {
  const outputDiv = document.getElementById("output1");
  const output = document.getElementById("output2");

  // Process DOCX file if present
  if (docxFile) {
    if (docxFile.name.endsWith(".docx")) {
      try {
        const arrayBuffer = await docxFile.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        output.innerHTML = `<p>${result.value.toUpperCase()}</p>`;
      } catch (error) {
        console.error("Error extracting text:", error);
        output.textContent =
          "Error extracting text. Please try a different file.";
      }
    } else {
      output.textContent = "Please upload a .docx file.";
    }
  }

  // Check if there are PDF files to process
  if (!pdfFiles.length) {
    outputDiv.textContent = "Please select one or more PDF files.";
    return;
  }

  outputDiv.textContent = "Processing PDFs...";

  // Extract text from each PDF file
  let allResults = "";
  for (let file of pdfFiles) {
    try {
      const text = await extractTextFromPDF(file);
      const cleaned_text = text.replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase();
      allResults += `File: ${file.name}\n\n${cleaned_text}\n\n------------------------\n\n`;
    } catch (error) {
      allResults += `Error processing ${file.name}: ${error.message}\n\n`;
    }
  }

  outputDiv.textContent = allResults;
}

// Helper function to extract text from a PDF
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += `Page ${i}:\n${pageText}\n\n`;
  }

  return fullText;
}
