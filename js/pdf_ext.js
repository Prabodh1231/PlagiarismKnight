import * as pdfjsLib from "./pdf.mjs";

// Set the worker source to the local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

// Initialize DOM elements
const extractButton = document.getElementById("checkplagrism");
const outputDiv = document.getElementById("output1");
const output = document.getElementById("output2");
const result_output = document.getElementById("output3");
const fileInput1 = document.getElementById("fileInput1");
const fileInput2 = document.getElementById("fileInput2");
const uploadArea1 = document.getElementById("uploadArea1");
const uploadArea2 = document.getElementById("uploadArea2");

let drop_pdfFiles = [];
let drop_docxfile = null;

// Prevent default drag behaviors
["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  uploadArea1.addEventListener(eventName, preventDefaults);
  uploadArea2.addEventListener(eventName, preventDefaults);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Handle PDF file drops
uploadArea1.addEventListener("drop", (event) => {
  preventDefaults(event);
  drop_pdfFiles = Array.from(event.dataTransfer.files).filter(
    (file) => file.type === "application/pdf"
  );
});

// Handle DOCX file drops
uploadArea2.addEventListener("drop", (event) => {
  preventDefaults(event);
  drop_docxfile = Array.from(event.dataTransfer.files).find((file) =>
    file.name.endsWith(".docx")
  );
});

extractButton.addEventListener("click", async () => {
  try {
    const pdfFiles = Array.from(fileInput1.files);
    const docxFile = fileInput2.files[0];

    let finalPdfFiles = [];
    let finalDocx = null;

    // Handle PDF files
    if (!drop_pdfFiles.length && !pdfFiles.length) {
      throw new Error("Please upload at least one PDF file.");
    }

    if (pdfFiles.length && drop_pdfFiles.length) {
      // Compare lastModified dates and keep the newer ones
      finalPdfFiles = [...pdfFiles, ...drop_pdfFiles].sort(
        (a, b) => b.lastModified - a.lastModified
      );
    } else {
      finalPdfFiles = pdfFiles.length ? pdfFiles : drop_pdfFiles;
    }

    // Handle DOCX file
    if (!docxFile && !drop_docxfile) {
      throw new Error("Please upload a .docx file.");
    }

    finalDocx =
      docxFile && drop_docxfile
        ? docxFile.lastModified > drop_docxfile.lastModified
          ? docxFile
          : drop_docxfile
        : docxFile || drop_docxfile;

    await extractTextFromMultiplePDFs(finalPdfFiles, finalDocx);
  } catch (error) {
    outputDiv.textContent = `Error: ${error.message}`;
  }
});

async function extractTextFromMultiplePDFs(pdfFiles, docxFile) {
  let cleanedClientInput;

  try {
    // Process DOCX file
    if (docxFile && docxFile.name.endsWith(".docx")) {
      try {
        const arrayBuffer = await docxFile.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        cleanedClientInput = cleanWord(result.value);
        output.innerHTML = `<p>${cleanedClientInput}</p>`;
      } catch (error) {
        throw new Error(`Error processing DOCX file: ${error.message}`);
      }
    }

    let arrayClientInput = cleanedClientInput.split(" ");
    let copyClientInput01 = [...arrayClientInput];

    // Process PDF files
    outputDiv.textContent = "Processing PDFs...";
    let allResults = "";

    for (const file of pdfFiles) {
      try {
        const text = await extractTextFromPDF(file);
        const cleaned_text = cleanWord(text);
        let arrayCompareInput = cleaned_text.split(" ");
        let sizeOfcompairArray = arrayCompareInput.length;
        let sizeOfClientInput = arrayClientInput.length;

        function findCommonElements(array1, array2) {
          // Create two separate copies of the input array
          let copyClientInput02 = [...array1]; // Copy 2

          for (let i = 0; i < sizeOfcompairArray; i++) {
            let startOfCompare = i;
            let endOfCompare = i + 13;
            let compareOther = array2.slice(startOfCompare, endOfCompare);

            for (let index = 0; index < sizeOfClientInput; index++) {
              let startOfClient = index;
              let endOfClient = index + 13;
              let compareClient = copyClientInput02.slice(
                startOfClient,
                endOfClient
              );

              // Check if all elements in compareClient exist in compareOther
              if (
                compareClient.every((compare) => compareOther.includes(compare))
              ) {
                // If so, create a highlighted version with red color
                let colorCommonElement = compareClient.map(
                  (common) => `<span style="color:red">${common}</span>`
                );
                // Replace the corresponding section in copyClientInput01 with the highlighted version
                copyClientInput01.splice(
                  startOfClient,
                  13,
                  ...colorCommonElement
                );
              }
            }
          }
          // // Return the modified copy of the input array
          // return copyClientInput01;
        }

        findCommonElements(arrayClientInput, arrayCompareInput);

        allResults += `File: ${file.name}\n\n${cleaned_text}\n\n------------------------\n\n`;
      } catch (error) {
        allResults += `Error processing ${file.name}: ${error.message}\n\n`;
      }
    }

    let highlightedTextString = copyClientInput01.join(" ");

    // Display the highlighted text in the HTML output element
    result_output.innerHTML = highlightedTextString;

    outputDiv.textContent = allResults || "No text extracted from PDFs.";
  } catch (error) {
    throw new Error(`Processing error: ${error.message}`);
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
    throw new Error(`PDF extraction error: ${error.message}`);
  }
}

function cleanWord(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "") // Remove non-alphanumeric characters
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim() // Remove leading/trailing spaces
    .toLowerCase();
}
