import * as pdfjsLib from "./pdf.mjs";

// Set the worker source to the local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

let extractButton = document.getElementById("checkplagrism");
extractButton.addEventListener("click", extractTextFromMultiplePDFs);

async function extractTextFromMultiplePDFs() {
  const fileInput1 = document.getElementById("fileInput1");
  const fileInput2 = document.getElementById("fileInput2");
  const outputDiv = document.getElementById("output1");

  const output = document.getElementById("output2");

  // Add event listener for file selection
  if (fileInput2.files.length > 0) {
    const file = fileInput2.files[0];
    if (file && file.name.endsWith(".docx")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({
          arrayBuffer: arrayBuffer,
        });
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

  if (!fileInput1.files.length && !fileInput2.file.length) {
    outputDiv.textContent = "Please select one or more PDF files.";
    return;
  }

  outputDiv.textContent = "Processing PDFs...";

  const files = Array.from(fileInput1.files);
  let allResults = "";

  for (let file of files) {
    try {
      const text = await extractTextFromPDF(file);
      let cleaned_text = text.replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase();
      allResults += `File: ${file.name}\n\n${cleaned_text}\n\n------------------------\n\n`;
    } catch (error) {
      allResults += `Error processing ${file.name}: ${error.message}\n\n`;
    }
  }

  outputDiv.textContent = allResults;
}

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
