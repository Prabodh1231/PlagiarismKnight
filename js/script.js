// Function to handle selected or dropped files and display their names and sizes
function handleFiles(files, previewElementId) {
  const preview = document.getElementById(previewElementId);
  preview.innerHTML = ""; // Clear existing preview

  for (const file of files) {
    const fileItem = document.createElement("p");
    fileItem.textContent = `File: ${file.name} (${(file.size / 1024).toFixed(
      2
    )} KB)`;
    preview.appendChild(fileItem);
  }
}

// Event listeners for drag-and-drop
document.querySelectorAll(".upload-area").forEach((uploadArea) => {
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
    const files = event.dataTransfer.files;
    if (uploadArea.id === "uploadArea1") {
      handleFiles(files, "preview1");
    } else if (uploadArea.id === "uploadArea2") {
      handleFiles(files, "preview2");
    }
  });
});

// Event listeners for file inputs
document.getElementById("fileInput1").addEventListener("change", (event) => {
  handleFiles(event.target.files, "preview1");
});

document.getElementById("fileInput2").addEventListener("change", (event) => {
  handleFiles(event.target.files, "preview2");
});
